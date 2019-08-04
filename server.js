require('dotenv').config()
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const compression = require('compression')
const multer = require('multer')
const uniqid = require('uniqid')
const Logger = require('./lib/Logger.class')
const DatabaseObject = require('./lib/DatabaseObject.class')
const ClientList = require('./lib/ClientList.class')
const SessionManager = require('./lib/SessionManager.class')
const MessageController = require('./lib/MessageController.class')
const RoomList = require('./lib/RoomList.class')
const CourseList = require('./lib/CourseList.class')

const upload = multer()

const config = {
    port: process.env.PORT || 4000,
    assets: "./runtime/assets"
}

const app = express()

const sessionManager = new SessionManager({
    assetsPath: config.assets
})

const messageController = new MessageController()

var httpserver, wss

const clients = {
    admin: new ClientList(),
    faculty: new ClientList(),
    student: new ClientList()
}

const rooms = new RoomList()
const courses = new CourseList()

const database = new DatabaseObject({
    hostname: 'localhost',
    port: 27017,
    database: 'rces'
})

messageController.AddControl("login", {
    callback: (connection, message) => {
        if(message.data.type !== "student") {
            database.GetAccount({type: message.data.type, username: message.data.username, password: message.data.password}).then((account) => {
                if(account) {

                    if(message.data.type === "admin") {
                        clients.admin.Add(message.data.username, account, connection)
                    }
                    else {
                        clients.faculty.Add(message.data.username, account, connection);
                    }

                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {},
                            error: null
                        },
                        template: message
                    })

                    MessageController.Broadcast({
                        list: clients.admin.GetBroadcastList(),
                        message: {
                            tag: "update.admin",
                            data: {
                                push: [account]
                            }
                        },
                        template: message
                    })
                }
                else {
                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {},
                            error: "There was a problem with either the username or the password"
                        },
                        template: message
                    })
                }
            })
        }
        else {
            database.GetStudent({ number: message.data.number }).then((account) => {
                if(account) {
                    // change identifier
                    clients.student.Add(account.number, account, connection)

                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: account,
                            error: null
                        },
                        template: message
                    })
                }
                else {
                    database.CreateStudent({ device_id: message.device_id, number: message.number }).then((id) => {
                        
                        clients.student.Add(message.number, { device_id: message.device_id, number: message.number, verified: false }, connection)

                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {},
                                error: null
                            },
                            template: message
                        })
                    })
                }
            })
        }
    },
    validations: {
        required: ["data.type"],
        conditional: [
            {when: "data.username", then: "data.password"},
            {when: "data.device_id", then: "data.number"}
        ]
    }
})

messageController.AddControl("verify.request", {
    callback: (connection, message) => {
        if(message.data.type === "student") {
            var id = clients.student.GetIdentifier(connection)
            var record = clients.student.GetRecord(id)
            var otp = MessageController.SendOTP(record.number)
            record.otp = { value: otp, validUntil: Date.now() + (2 * 60 * 1000) }
            clients.student.ChangeRecord(id, record)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        status: "sent"
                    }
                },
                template: message
            })
            Logger.Info("OTP for " + id + " is " + otp)
        } else if(message.data.type === "faculty") {
            var id = clients.faculty.GetIdentifier(connection)
            var record = clients.faculty.GetRecord(id)
            MessageController.SendEmail(message.data.email, {
                name: record.username,
                link: "https://foogle.com/verify"
            })
            record.otp = { value: otp, validUntil: Date.now() + (60 * 60 * 1000) }
            clients.faculty.ChangeRecord(id, record)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        status: "sent"
                    }
                },
                template: message
            })
        } else if(message.data.type === "admin") {
            var id = clients.admin.GetIdentifier(connection)
            var record = clients.admin.GetRecord(id)
            var otp = MessageController.SendEmail(message.data.email, {
                name: record.username,
                link: "https://foogle.com/verify"
            })
            record.otp = { value: otp, validUntil: Date.now() + (60 * 60 * 1000) }
            clients.admin.ChangeRecord(id, record)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        status: "sent"
                    }
                },
                template: message
            })
        }
    },
    validations: {
        required: ["data.type"],
        conditional: [
            {when: "data.username", then: "data.email"},
            {when: "data.device_id", then: "data.number"}
        ]
    }
})

messageController.AddControl("verify.check", {
    callback: (connection, message) => {
        var id = clients.student.GetIdentifier(connection)
        if(id) {
            var record = clients.student.GetRecord(id)
            if(record.otp) {
                if(Date.now() < record.otp.validUntil) {
                    if(record.otp.value === message.data.otp) {
                        database.UpdateStudent(id, {
                            $set: {
                                verified: true
                            }
                        }).then((res) => {
                            record.verified = true
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        verified: true
                                    }
                                },
                                template: message
                            })
                        }).catch((e) => {
                            MessageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        verified: false
                                    },
                                    error: "Server Error"
                                },
                                template: message
                            })
                            Logger.Error(e)
                        })
                    }
                    else {
                        MessageController.SendMessage({
                            connection: connection,
                            message: {
                                data: {
                                    verified: false
                                },
                                error: "Invalid OTP"
                            },
                            template: message
                        })
                    }
                }
                else {
                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {
                                verified: false
                            },
                            error: "OTP Validity timed out"
                        },
                        template: message
                    })
                }
            }
        }
    },
    validations: {
        required: ["data.otp"]
    }
})

messageController.AddControl("get.me", {
    callback: (connection, message) => {
        var id
        if(id = clients.student.GetIdentifier(connection)) {
            var record = clients.student.GetRecord(id)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: record
                },
                template: message
            })
        }
        else if(id = clients.faculty.GetIdentifier(connection)) {
            var record = clients.faculty.GetRecord(id)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: record
                },
                template: message
            })
        }
        else if(id = clients.admin.GetIdentifier(connection)) {
            var record = clients.admin.GetRecord(id)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: record
                },
                template: message
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "No such record exists"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("get.students.active", {
    callback: (connection, message) => {
        var id
        if(id = clients.faculty.GetIdentifier(connection)) {
            var records = clients.student.GetRecords()
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: records
                },
                template: message
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("get.students", {
    callback: (connection, message) => {
        var id
        if(id = clients.faculty.GetIdentifier(connection)) {
            database.GetStudents(message.data).then((records) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: records
                    },
                    template: message
                })
            })
        }
        else if(id = clients.admin.GetIdentifier(connection)) {
            database.GetStudents(message.data).then((records) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: records
                    },
                    template: message
                })
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("get.faculties.active", {
    callback: (connection, message) => {
        var id
        if(id = clients.admin.GetIdentifier(connection)) {
            var records = clients.faculty.GetRecords()
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: records
                },
                template: message
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("get.faculties", {
    callback: (connection, message) => {
        var id
        if(id = clients.admin.GetIdentifier(connection)) {
            message.data.type = 'faculty';
            database.GetAccounts(message.data).then((records) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: records
                    },
                    template: message
                })
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("get.rooms", {
    callback: (connection, message) => {
        MessageController.SendMessage({
            connection: connection,
            message: {
                data: rooms
            },
            template: message
        })
    }
})

messageController.AddControl("get.courses", {
    callback: (connection, message) => {
        MessageController.SendMessage({
            connection: connection,
            message: {
                data: courses
            },
            template: message
        })
    }
})

messageController.AddControl("set.me", {
    callback: (connection, message) => {
        var id
        if(id = clients.student.GetIdentifier(connection)) {
            var record = clients.student.GetRecord(id)
            database.UpdateStudent(record.number, message.data).then((updated) => {
                clients.student.ChangeRecord(record.number, updated)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: true
                        }
                    },
                    template: message
                })
            }).catch((e) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: false
                        },
                        error: "Server Error"
                    },
                    template: message
                })
                Logger.Error(e)
            })
        }
        else if(id = clients.faculty.GetIdentifier(connection)) {
            var record = clients.faculty.GetRecord(id)
            database.UpdateAccount('faculty', record.username, message.data).then((updated) => {
                clients.faculty.ChangeRecord(record.username, updated)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: true
                        }
                    },
                    template: message
                })
            }).catch((e) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: false
                        },
                        error: "Server Error"
                    },
                    template: message
                })
                Logger.Error(e)
            })
        }
        else if(id = clients.admin.GetIdentifier(connection)) {
            var record = clients.admin.GetRecord(id)
            database.UpdateAccount('admin', record.username, message.data).then((updated) => {
                clients.faculty.ChangeRecord(record.username, updated)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: true
                        }
                    },
                    template: message
                })
            }).catch((e) => {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: false
                        },
                        error: "Server Error"
                    },
                    template: message
                })
                Logger.Error(e)
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "No such record exists"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("set.room", {
    callback: (connection, message) => {
        var id
        if(id = clients.admin.GetIdentifier(connection)) {
            if(rooms.Has(message.data.code)) {
                if(rooms.UpdateRoom(message.data)) {
                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {
                                modified: true
                            }
                        },
                        template: message
                    })
                } else {
                    MessageController.SendMessage({
                        connection: connection,
                        message: {
                            data: {
                                modified: false
                            },
                            error: "Room does not exist or might be currently in use."
                        },
                        template: message
                    })
                }
            }
            else {
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: false
                        },
                        error: "The room is not in record."
                    },
                    template: message
                })
            }
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        modified: false
                    },
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("set.course", {
    callback: (connection, message) => {
        var id
        if(id = clients.faculty.GetIdentifier(connection)) {
            if(courses.Has(message.data.code)) {
                courses.UpdateCourse(message.data)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            modified: true
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
                            modified: false
                        },
                        error: "The course is not in record."
                    },
                    template: message
                })
            }
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        modified: false
                    },
                    error: "Access Denied"
                },
                template: message
            })
        }
    }
})

messageController.AddControl("add.admin", {
    callback: (connection, message) => {
        var creator_username = clients.admin.GetIdentifier(connection)
        if(creator_username) {
            var record = { type: 'admin', username: message.data.username, password: message.data.password, authorizer: creator_username }
            if(message.data.hasOwnProperty('email'))
                record.email = message.data.email
            if(message.data.hasOwnProperty('phone'))
                record.phone = message.data.phone
            database.CreateAccount(record).then((id) => {
                clients.admin.Add(message.data.username, record, connection)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            created: true
                        }
                    },
                    template: message
                })
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        created: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    },
    validations: {
        required: ["data.username", "data.password"]
    }
})

messageController.AddControl("add.faculty", {
    callback: (connection, message) => {
        var creator_username = clients.admin.GetIdentifier(connection)
        if(creator_username) {
            var record = { type: 'faculty', username: message.data.username, password: message.data.password, authorizer: creator_username }
            if(message.data.hasOwnProperty('name'))
                record.name = message.data.name;
            if(message.data.hasOwnProperty('designation'))
                record.designation = message.data.designation
            if(message.data.hasOwnProperty('email'))
                record.email = message.data.email
            if(message.data.hasOwnProperty('phone'))
                record.phone = message.data.phone
            database.CreateAccount(record).then((id) => {
                clients.faculty.Add(message.data.username, record, connection)
                MessageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {
                            created: true
                        }
                    },
                    template: message
                })
            })
        }
        else {
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        created: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    }
})

messageController.AddControl("add.course", {
    callback: (connection, message) => {
        var id = clients.faculty.GetIdentifier(connection)
        if(id) {
            courses.AddCourse(message.data)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        created: true
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
                        created: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    }
})

messageController.AddControl("add.room", {
    callback: (connection, message) => {
        var id = clients.admin.GetIdentifier(connection)
        if(id) {
            rooms.AddRoom(message.data)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        created: true
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
                        created: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    }
})

messageController.AddControl("remove.room", {
    callback: (connection, message) => {
        var id = clients.admin.GetIdentifier(connection)
        if(id) {
            rooms.RemoveRoom(message.data.code)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        removed: true
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
                        removed: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    },
    validations: {
        required: ["data.code"]
    }
})

messageController.AddControl("remove.course", {
    callback: (connection, message) => {
        var id = clients.faculty.GetIdentifier(connection)
        if(id) {
            courses.RemoveCourse(message.data.code)
            MessageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        removed: true
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
                        removed: false
                    },
                    error: "Access Denied."
                },
                template: message
            })
        }
    },
    validations: {
        required: ["data.code"]
    }
})

database.Init().then(() => {

    database.LoadRooms().then((list) => {
        rooms.AddRooms(list)
    })

    database.LoadCourses().then((list) => {
        courses.AddCourses(list)
    })

    app.use(compression())
    app.use(express.static('public'))

    httpserver = http.createServer(app)

    wss = new WebSocket.Server({ server: httpserver })

    app.post('/upload', upload.fields([
        {name: "token", maxCount: 1},
        {name: "type", maxCount: 1},
        {name: "file", maxCount: 1},
    ]), (req, res) => {
        var token = req.body.token
        var type = req.body.type
        var file = req.files.file[0]
        if(!sessionManager.Has(token))
            res.end(JSON.stringify({
                error: true,
                status: "No such session recorded"
            }))
        var id = null
        if(type === "media")
            id = sessionManager.AddResource(token, file)
        else
            sessionManager.AddMediaChunk(token, file)
        res.end(JSON.stringify({
            error: false,
            status: "Done",
            id: id
        }))
    })

    app.post('/resource', upload.fields([
        {name: "token", maxCount: 1},
        {name: "id", maxCount: 1}
    ]), (req, res) => {
        
        var token = req.body.token || null
        var id = req.body.id

        var resource = sessionManager.GetResource({
            token: token,
            resource_id: id
        })
        
        if(resource.type === "media")
            res.sendFile(config.assets + "/media/" + resource.name)
        else
            res.sendFile(config.assets + "/recording/" + resource.name)
    })

    wss.on('connection', (ws) => {
        ws.id = uniqid();
        ws.on('message', (message) => {
            console.log(message)
            try {
                var messageObject = JSON.parse(message)
                messageController.Eval(ws, messageObject)
            } catch(e) {
                Logger.Error(e)
            }
        })
        ws.on('close', () => {
            console.log('CLOSED CONNECTION')
        })
    })

    httpserver.listen(config.port, () => {
        console.log("Server Started and Running at port: " + config.port)
    })
})

const sigs = ['SIGINT', 'SIGTERM', 'SIGQUIT']
sigs.forEach(sig => {
    process.on(sig, () => {
        console.log("Shutting down Server")
        wss.close()
        httpserver.close()
        database.SaveRooms(rooms.GetRooms()).then((res) => {
            database.SaveCourses(courses.GetCourses()).then((res) => {
                database.Close()
                console.log("Done.")
                process.exit(0)
            })
        })
    })
})