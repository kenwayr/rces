const MessageController = require('../lib/MessageController.class');
const uniqid = require('uniqid');
const QRValidator = new RegExp(/^[^;]+;\d+;\d+$/);
module.exports = class ClassroomSessionDriver {
    run(messageController, { sessionManager, resourceManager, clients, rooms, database }) {
        messageController.AddControl('start.session', {
            callback: (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection)
                if(id) {
                    var records = clients.faculty.GetRecord(id)
                    if(records.session && records.session.active === true)
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    started: false
                                },
                                error: "A session is already active"
                            },
                            template: message
                        })
                    else {
                        if(!rooms.GetRoom(message.data.room.code).usage.inUse) {
                            var recordingResourceId = resourceManager.CreateResource({ filename: 'recording.ogg', type: 'recording' })
                            var token = sessionManager.StartSession(id, message.data.course, message.data.room, recordingResourceId, resourceManager.GetResourceWriteStream(recordingResourceId))
                            rooms.SetSession(message.data.room.code, token, "session");
                            records.session = { active: true, token: token, room_code: message.data.room.code, course_code: message.data.course.code }
                            clients.faculty.ChangeRecord(id, records)
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        started: true,
                                        token: token
                                    }
                                },
                                template: message
                            })
                        }
                        else {
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        started: false
                                    },
                                    error: "Room is already in use"
                                },
                                template: message
                            })
                        }
                    }
                }
            },
            validations: {
                required: ["data.course", "data.room"]
            }
        });
        
        messageController.AddControl('stop.session', {
            callback: (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection)
                if(id) {
                    var records = clients.faculty.GetRecord(id)
                    if(records.session && records.session.active === true) {
                        if(sessionManager.Has(records.session.token)) {
                            var data = sessionManager.EndSession(records.session.token)
                            rooms.UnsetSession(records.session.room_code)
                            var res = database.SaveSession(data)
                        }
                        records.session.active = false;
                        clients.faculty.ChangeRecord(id, records)
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
                            return v.session && v.session.facultyConnection.id === connection.id;
                        })
                        for(var i=0; i < connectedStudents.length; i++)
                            MessageController.SendMessage({
                                connection: clients.student.GetConnection(connectedStudents[i].number),
                                message: {
                                    tag: "stop.session",
                                    data: {}
                                },
                                template: {}
                            })
                    }
                    else {
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    stopped: false
                                },
                                error: "No session is active"
                            },
                            template: message
                        })
                    }
                }
            }
        });

        messageController.AddControl("get.sessions", {
            callback: (connection, message) => {
                var id = clients.faculty.GetIdentifier(connection)
                if(id) {
                    database.GetSessions(id).then((sessions) => {
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: sessions
                            },
                            template: message
                        })
                    })
                }
            }
        });
        
        messageController.AddControl('join.session', {
            callback: (connection, message) => {
                var id = clients.student.GetIdentifier(connection)
                var qrTest = QRValidator.test(message.data.qrcode)
                if(id) {
                    if(qrTest) {
                        var records = clients.student.GetRecord(id)
                        var qrData = message.data.qrcode.split(";");
                        var room_code = qrData[0];
                        if(rooms.Has(room_code)) {
                            if(rooms.GetRoom(room_code).usage.inUse) {
                                if(!rooms.GetOccupancy(room_code, qrData[1], qrData[2])) {
                                    if(rooms.SetOccupancy(room_code, qrData[1], qrData[2], true)) {
                                        var sessionId = rooms.GetRoom(room_code).usage.sessionId
                                        var sessionObject = sessionManager.GetSession(sessionId)
                                        var facultyConnection = clients.faculty.GetConnection(sessionObject.session.faculty)
                                        MessageController.SendMessage({
                                            connection: facultyConnection,
                                            message: {
                                                tag: "event.student",
                                                data: {
                                                    type: "join",
                                                    number: records.number,
                                                    seat: {
                                                        row: qrData[1],
                                                        col: qrData[2]
                                                    },
                                                    timestamp: Date.now()
                                                }
                                            },
                                            template: message
                                        })
        
                                        sessionManager.AddEvent(sessionId, { type: "join", number: records.number, seat: { row: qrData[1], col: qrData[2] } });
        
                                        records.session = {
                                            token: sessionId,
                                            start: sessionObject.session.date.start.UTCTimestampMillis,
                                            room: sessionObject.session.room,
                                            nrow: qrData[1],
                                            ncol: qrData[2],
                                            course: sessionObject.session.course,
                                            facultyConnection: facultyConnection
                                        }
        
                                        var faculty = clients.faculty.GetRecord(sessionObject.session.faculty);
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
                                                    start: sessionObject.session.date.start.UTCTimestampMillis,
                                                    room: sessionObject.session.room,
                                                    course: sessionObject.session.course,
                                                    faculty: facultyRecord
                                                }
                                            },
                                            template: message
                                        })
                                        clients.student.ChangeRecord(id, records)
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
                                    console.log(rooms.GetRoom(room_code));
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
                        }
                        else {
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
                    else {
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {},
                                error: "QR Code is not valid"
                            },
                            template: message
                        })
                    }
                }
                else {
                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {},
                            error: "You have not logged in"
                        },
                        template: message
                    })
                }
            },
            validations: {
                required: ["data.qrcode"]
            }
        });
        
        messageController.AddControl('event.student', {
            callback: (connection, message) => {
                var id = clients.student.GetIdentifier(connection)
                if(id) {
                    var records = clients.student.GetRecord(id)
                    message.data.number = records.number
                    if(records.session) {
                        if(!message.data.id)
                            message.data.id = uniqid();
                        sessionManager.AddEvent(records.session.token, message.data);
                        MessageController.SendMessage({
                            connection: records.session.facultyConnection,
                            message: message,
                            template: message
                        })
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    logged: true,
                                    id: message.data.id
                                }
                            },
                            template: message
                        });
                    }
                }
            }
        });
    }
}