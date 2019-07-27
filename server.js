require('dotenv').config()
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const compression = require('compression')
const multer = require('multer')
const Logger = require('./lib/Logger.class')
const DatabaseObject = require('./lib/DatabaseObject.class')
const ClientList = require('./lib/ClientList.class')
const SessionManager = require('./lib/SessionManager.class')
const MessageController = require('./lib/MessageController.class')

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
                    clients.student.Add(account.device_id, account, connection)

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
                        
                        clients.student.Add(message.device_id, { device_id: message.device_id, number: message.number, verified: false }, connection)

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
            messageController.SendMessage({
                connection: connection,
                message: {
                    data: {
                        status: "sent"
                    }
                },
                template: message
            })
        } else if(message.data.type === "faculty") {
            var id = clients.faculty.GetIdentifier(connection)
            var record = clients.faculty.GetRecord(id)
            MessageController.SendEmail(message.data.email, {
                name: record.username,
                link: "https://foogle.com/verify"
            })
            record.otp = { value: otp, validUntil: Date.now() + (60 * 60 * 1000) }
            clients.faculty.ChangeRecord(id, record)
            messageController.SendMessage({
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
            messageController.SendMessage({
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
                            messageController.SendMessage({
                                connection: connection,
                                message: {
                                    data: {
                                        verified: true
                                    }
                                },
                                template: message
                            })
                        }).catch((e) => {
                            messageController.SendMessage({
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
                        messageController.SendMessage({
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
                    messageController.SendMessage({
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
        required: ["device_id", "data.otp"]
    }
})

messageController.AddControl("get", {
    callback: (connection, message) => {
        var id = clients.student.GetIdentifier(connection)
        if(id) {
            var record = clients.student.GetRecord(id)
            database.GetStudent({number: record.number}).then((account) => {
                messageController.SendMessage({
                    connection: connection,
                    message: {
                        data: account
                    },
                    template: message
                })
            }).catch((e) => {
                messageController.SendMessage({
                    connection: connection,
                    message: {
                        data: {},
                        error: "Server Error"
                    },
                    template: message
                })
                Logger.Error(e)
            })
        }
        else {
            messageController.SendMessage({
                connection: connection,
                message: {
                    data: {},
                    error: "No such device exists"
                },
                template: message
            })
        }
    }
})

database.Init().then(() => {
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