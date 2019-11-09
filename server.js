require('dotenv').config()
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const compression = require('compression')
const multer = require('multer')
const uniqid = require('uniqid')
const path = require('path')
const mime = require('mime-types')
const Logger = require('./lib/Logger.class')
const DatabaseObject = require('./lib/DatabaseObject.class')
const ClientList = require('./lib/ClientList.class')
const MessageController = require('./lib/MessageController.class')
const RoomList = require('./lib/RoomList.class')
const CourseList = require('./lib/CourseList.class')
const package = require('./package.json')

const SessionManager = require('./lib/SessionManager.class')
const ResourceManager = require('./lib/ResourceManager.class')
const TestManager = require('./lib/TestManager.class')

const BootstrapDriver = require('./drivers/Bootstrap.driver')
const ClassroomSessionDriver = require('./drivers/ClassroomSession.driver')
const CrowdTestDriver = require('./drivers/CrowdTest.driver')

const upload = multer()

const config = {
    port: process.env.PORT || 4000,
    assets: "./runtime/assets"
}

const app = express()

const sessionManager = new SessionManager()

const resourceManager = new ResourceManager()

const testManager = new TestManager()

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
});

messageController.AddDriver(BootstrapDriver, {
    sessionManager: sessionManager,
    resourceManager: resourceManager,
    clients: clients,
    rooms: rooms,
    courses: courses,
    database: database,
    testManager: testManager
});
messageController.AddDriver(ClassroomSessionDriver, { 
    sessionManager: sessionManager,
    resourceManager: resourceManager,
    clients: clients,
    rooms: rooms,
    database: database
});
messageController.AddDriver(CrowdTestDriver, {
    testManager: testManager,
    clients: clients,
    rooms: rooms
});

database.Init().then(() => {

    database.LoadRooms().then((list) => {
        rooms.AddRooms(list)
    })

    database.LoadCourses().then((list) => {
        courses.AddCourses(list)
    })

    database.LoadResources().then((list) => {
        resourceManager.AddResources(list)
    })

    app.use(compression())
    app.use(express.static('public'))

    httpserver = http.createServer(app)

    wss = new WebSocket.Server({ server: httpserver })

    app.get('/info/json', (req,res) => {
        res.end(JSON.stringify({
            server: {
                name: package.name,
                version: package.version,
                description: package.description,
                author: package.author,
                license: package.license
            },
            app: {
                name: 'RCES Mobile',
                version: '0.0.1',
                description: 'RCES Mobile App for students',
                author: 'Tamal Das',
                license: 'MIT'
            }
        }))
    })

    app.post('/upload', upload.fields([
        {name: "token", maxCount: 1},
        {name: "type", maxCount: 1},
        {name: "file", maxCount: 1}
    ]), (req, res) => {
        var token = req.body.token
        var type = req.body.type
        var file = req.files.file[0]
        if(token) {
            if(!sessionManager.Has(token)) {
                res.end(JSON.stringify({
                    error: true,
                    status: "No such session recorded"
                }))
            }
            else {
                var id = null
                if(type === "media") {
                    id = resourceManager.CreateResource({filename: file.originalname, type: 'media'}, file)
                    sessionManager.AddResource(token, id)
                } else {
                    sessionManager.AddMediaChunk(token, file.buffer)
                }
                res.end(JSON.stringify({
                    error: false,
                    status: "Done",
                    id: id
                }))
            }
        }
        else {
            var id = resourceManager.CreateResource({filename: file.originalname, type: type || 'media'}, file)
            res.end(JSON.stringify({
                error: false,
                status: "Done",
                id: id
            }))
        }
    })

    app.get('/resource', upload.fields([
        {name: "id", maxCount: 1},
        {name: "a", maxCount: 1}
    ]), (req, res) => {
        var id = req.query.id
        var action = req.query.a
        if(resourceManager.Has(id)) {
            var resource = resourceManager.GetResource(id)
            if(action && action === 'stream') {

                var stat = resourceManager.GetResourceStats(id)
                
                res.writeHead(200, {
                    'Content-Type': 'audio/ogg',
                    'Content-Length': stat.size
                });

                var stream = resourceManager.GetResourceReadStream(id)
                stream.pipe(res)

            } else if(action === 'raw') {
                var respath = path.join(__dirname, resourceManager.base + id);
                res.setHeader("Content-Type", mime.contentType(resource.filename));
                res.setHeader("Content-Dispositon","attachment; filename=" + resource.filename);
                res.sendFile(respath);
            } else
                res.download(resourceManager.base + id, resource.filename)
        }
        else
            res.end()
    })

    wss.on('connection', (ws) => {
        ws.id = uniqid();
        ws.on('message', (message) => {
            try {
                var messageObject = JSON.parse(message)
                console.log(messageObject.tag);
                messageController.Eval(ws, messageObject)
            } catch(e) {
                Logger.Error(e)
            }
        })
        ws.on('close', () => {
            messageController.Eval(ws, {
                tag: "exit",
                data: {}
            })
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
                database.SaveResources(resourceManager.GetResources()).then((res) => {
                    database.Close()
                    console.log("Done.")
                    process.exit(0)
                })
            })
        })
    })
})