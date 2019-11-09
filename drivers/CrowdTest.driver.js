const MessageController = require('../lib/MessageController.class');
const QRValidator = new RegExp(/^[^;]+;\d+;\d+$/);
module.exports = class ClassroomSessionDriver {
    run(messageController, { testManager, clients, rooms }) {
        messageController.AddControl('start.test', {
            callback: (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection);
                if(id) {
                    var record = clients.faculty.GetRecord(id);
                    if(record.test && record.test.active === true)
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    started: false
                                },
                                error: "A test is already active"
                            },
                            template: message
                        });
                    else {
                        if(!rooms.GetRoom(message.data.room.code).usage.inUse) {
                            var token = testManager.StartTest(id, message.data.course, message.data.room);
                            rooms.SetSession(message.data.room.code, token, "test");
                            record.test = { active: true, token: token, room_code: message.data.room.code, course_code: message.data.course.code };
                            clients.faculty.ChangeRecord(id, record);
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        started: true,
                                        token: token
                                    }
                                },
                                template: message
                            });
                        }
                        else
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        started: false
                                    },
                                    error: "Room is already in use"
                                },
                                template: message
                            });
                    }
                }
            },
            validations: {
                required: ["data.course", "data.room"]
            }
        });
        messageController.AddControl('stop.test', {
            callback: (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection)
                if(id) {
                    var record = clients.faculty.GetRecord(id)
                    if(record.test && record.test.active === true) {
                        var testData = null;
                        if(testManager.Has(record.test.token)) {
                            testData = testManager.EndTest(record.test.token);
                            rooms.UnsetSession(record.test.room_code);
                        }
                        record.test.active = false;
                        clients.faculty.ChangeRecord(id, record)
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    stopped: true
                                }
                            },
                            template: message
                        })
                        var connectedStudents = clients.student.GetRecords().filter((v) => {
                            return v.test && v.test.facultyConnection.id === connection.id;
                        })
                        for(var i=0; i < connectedStudents.length; i++)
                            MessageController.SendMessage({
                                connection: clients.student.GetConnection(connectedStudents[i].number),
                                message: {
                                    tag: "stop.test",
                                    data: {
                                        score: testData !== null ? testData.data.get(connectedStudents[i].number) : 0
                                    }
                                },
                                template: message
                            });
                    }
                    else
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    stopped: false
                                },
                                error: "No session is active"
                            },
                            template: message
                        });
                }
            },
            validations: {}
        });
        messageController.AddControl('join.test', {
            callback: (connection, message) => {
                var id = clients.student.GetIdentifier(connection);
                var qrTest = QRValidator.test(message.data.qrcode);
                if(id) {
                    if(qrTest) {
                        var record = clients.student.GetRecord(id);
                        var qrData = message.data.qrcode.split(";");
                        var room_code = qrData[0];
                        if(rooms.Has(room_code)) {
                            if(rooms.GetRoom(room_code).usage.inUse) {
                                if(!rooms.GetOccupancy(room_code, qrData[1], qrData[2])) {
                                    if(rooms.SetOccupancy(room_code, qrData[1], qrData[2], true)) {
                                        var testId = rooms.GetRoom(room_code).usage.sessionId;
                                        var testObject = testManager.GetTest(testId);
                                        var facultyConnection = clients.faculty.GetConnection(testObject.faculty);
                                        MessageController.SendMessage({
                                            connection: facultyConnection,
                                            message: {
                                                tag: "event.student",
                                                data: {
                                                    type: "join",
                                                    number: record.number,
                                                    seat: {
                                                        row: qrData[1],
                                                        col: qrData[2]
                                                    },
                                                    timestamp: Date.now()
                                                }
                                            },
                                            template: message
                                        });

                                        record.test = {
                                            token: testId,
                                            start: testObject.date.start.UTCTimestampMillis,
                                            room: testObject.room,
                                            nrow: qrData[1],
                                            ncol: qrData[2],
                                            course: testObject.course,
                                            facultyConnection: facultyConnection
                                        };

                                        var faculty = clients.faculty.GetRecord(testObject.faculty);
                                        var facultyRecord = {
                                            username: faculty.username,
                                            name: faculty.name,
                                            designation: faculty.designation,
                                            dp: faculty.dp
                                        };

                                        MessageController.SendMessage({
                                            connection: connection,
                                            message: {
                                                data: {
                                                    start: testObject.date.start.UTCTimestampMillis,
                                                    room: testObject.room,
                                                    course: testObject.course,
                                                    faculty: facultyRecord
                                                }
                                            },
                                            template: message
                                        });
                                        clients.student.ChangeRecord(id, record);
                                        testObject.bank.AddCandidate(id);
                                    } else {
                                        MessageController.SendMessage({
                                            connection: connection,
                                            message: {
                                                data: {},
                                                error: "This seat is not valid"
                                            },
                                            template: message
                                        })
                                    }
                                } else {
                                    MessageController.SendMessage({
                                        connection: connection,
                                        message: {
                                            data: {},
                                            error: "This seat is already taken"
                                        },
                                        template: message
                                    })
                                }
                            } else
                                MessageController.SendMessage({
                                    connection: connection,
                                    message: {
                                        data: {},
                                        error: "No ongoing sessions in this classroom"
                                    },
                                    template: message
                                })
                        } else {
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {},
                                    error: "No such classroom exists"
                                },
                                template: message
                            })
                        }
                    }
                }
            },
            validations: {
                required: ["data.qrcode"]
            }
        });
        messageController.AddControl('submit.questions', {
            callback: (connection, message) => {
                var id = clients.student.GetIdentifier(connection);
                if(id) {
                    var record = clients.student.GetRecord(id);
                    if(record.test) {
                        var testObject = testManager.GetTest(record.test.token);
                        for(var i=0; i < message.data.questions.length; i++) {
                            var question = message.data.questions[i];
                            question['author'] = id;
                            testObject.bank.AddQuestion(question);
                        }
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    status: true
                                }
                            },
                            template: message
                        });
                    } else
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {},
                                error: "No test ongoing"
                            },
                            template: message
                        });
                }
            },
            validations: {
                required: ["data.questions"]
            }
        });
        messageController.AddControl('submit.answer', {
            callback: (connection, message) => {
                var id = clients.student.GetIdentifier(connection);
                if(id) {
                    var record = clients.student.GetRecord(id);
                    if(record.test) {
                        var testObject = testManager.GetTest(record.test.token);
                        var status = testObject.bank.SubmitAnswer(id, message.data.answer);
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    status: status
                                }
                            },
                            template: message
                        });
                    } else
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {},
                                error: "No test ongoing"
                            },
                            template: message
                        });
                }
            },
            validations: {
                required: ["data.answer"]
            }
        });
        messageController.AddControl('distribute.sets', {
            callback: async (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection);
                if(id) {
                    var record = clients.faculty.GetRecord(id);
                    if(record.test && record.test.active === true) {
                        var testObject = testManager.GetTest(record.test.token);
                        var report = await testObject.bank.GenerateSets();
                        
                        
                        var sets = testObject.bank.GetSets();

                        sets.forEach((set, client_id) => {
                            var connection = clients.student.GetConnection(client_id);
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    tag: "questions",
                                    data: {
                                        questions: [...set.values()]
                                    }
                                },
                                template: message
                            });
                        });
                        
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    report: report
                                }
                            },
                            template: message
                        });
                    } else
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {},
                                error: "No test ongoing"
                            },
                            template: message
                        });
                }
            },
            validations: {}
        });
    }
};