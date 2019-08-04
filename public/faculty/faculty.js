var AdminSocket = function (url){
    this.url = url;
    this.connection = null;
    this.handlers = {onOpen: null, onMessage: null, onError: null, onClose: null};
    var WebSocket = window.WebSocket || window.MozWebSocket;
    if(!WebSocket)
        throw new Error("This browser does not support Web Sockets. Please update or switch browsers.");
    else
        this.connection = new WebSocket(this.url);
    this.send = function(data = {}) {
        var dataJSON = JSON.stringify(data);
        this.connection.send(dataJSON);
    };
    this.setHandlers = function({onOpen = null, onMessage = null, onError = null, onClose = null}) {
        this.handlers = {onOpen: onOpen, onMessage: onMessage, onError: onError, onClose: onClose};
        this.connection.onopen = onOpen;
        this.connection.onmessage = onMessage;
        this.connection.onerror = onError;
        this.connection.onclose = onClose;
    };
    this.refresh = function () {
        if(!WebSocket)
            throw new Error("This browser does not support Web Sockets. Please update or switch browsers.");
        else
        {
            this.connection = new WebSocket(this.url);
            this.setHandlers(this.handlers);
        }
    };
};

function generateID(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}


var App = function() {

    var mConnection = {username: null, connected: false, verified: false, active_course: null, active_room: null};

    var socket = new AdminSocket("ws://localhost:1337/");
    var request_map = new Map();
    var context = this;

    var mNotificationsArray = [];
    var mStudentsArray = [];
    var mFacultyArray = [];
    var mAdminsArray = [];
    var mRoomsArray = [];
    var mStudentEventArray = [];

    var notificationsArrayChangeCallbacks = [];
    var studentsArrayChangeCallbacks = [];
    var facultyArrayChangeCallbacks = [];
    var adminsArrayChangeCallbacks = [];
    var roomsArrayChangeCallbacks = [];
    var studentEventArrayChangeCallbacks = [];
    var connectionChangeCallbacks = [];
    var closeCallbacks = [];

    var notificationChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < notificationsArrayChangeCallbacks.length; i++)
                notificationsArrayChangeCallbacks[i](target);
            return true;
        }};
    var studentsChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < studentsArrayChangeCallbacks.length; i++)
                studentsArrayChangeCallbacks[i](target);
            return true;
        }};
    var facultyChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < facultyArrayChangeCallbacks.length; i++)
                facultyArrayChangeCallbacks[i](target);
            return true;
        }};
    var adminChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < adminsArrayChangeCallbacks.length; i++)
                adminsArrayChangeCallbacks[i](target);
            return true;
        }};
    var roomsChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < roomsArrayChangeCallbacks.length; i++)
                roomsArrayChangeCallbacks[i](target);
            return true;
        }};
    var connectionChangeHandler = {
        get: function(target, property) {
            return target[property];
        },
        set: function(target, property, value, receiver) {
            target[property] = value;
            for(var i=0; i < connectionChangeCallbacks.length; i++)
                connectionChangeCallbacks[i](target);
            return true;
        }};

    this.notifications = new Proxy(mNotificationsArray, notificationChangeHandler);
    this.students = new Proxy(mStudentsArray, studentsChangeHandler);
    this.faculties = new Proxy(mFacultyArray, facultyChangeHandler);
    this.admins = new Proxy(mAdminsArray, adminChangeHandler);
    this.rooms = new Proxy(mRoomsArray, roomsChangeHandler);
    this.connection = new Proxy(mConnection, connectionChangeHandler);

    socket.setHandlers(
        {
            onOpen: function() {
                context.connection.connected = true;
            },
            onClose: function() {
                context.connection.connected = false;
                context.connection.verified = false;
            },
            onMessage: function(msg) {
                var message = JSON.parse(msg.data);
                if(message.tag === "event" && message.type === "push")
                {
                    for(var key in message.data)
                    {
                        if(message.data.hasOwnProperty(key))
                        {
                            if(key === "notifications")
                                for(var i=0; i < message.data.notifications.length; i++)
                                    context.notifications.push(message.data.notifications[i]);
                        }
                    }
                }
                else if(message.tag === "event" && message.type === "update")
                {
                    for(var key in message.data)
                    {
                        if(message.data.hasOwnProperty(key))
                        {
                            if(context.hasOwnProperty(key))
                            {
                                context[key].splice(0, context[key].length);
                                Array.prototype.push.apply(context[key], message.data[key]);
                            }
                        }
                    }
                }
                else if(message.tag === "event" && message.type === "student")
                {
                	for(var i=0; i < studentEventArrayChangeCallbacks.length; i++)
                	{
                		studentEventArrayChangeCallbacks[i](message.data);
                	}
                }
                else if(message.hasOwnProperty("meta") && request_map.has(message.meta.request_code))
                    request_map.get(message.meta.request_code)(message);
            },
            onError: function(e) {
                throw new Error(e);
            }
        }
    );

    this.addCallback = function(variable, callback) {
        if(variable === "students")
            studentsArrayChangeCallbacks.push(callback);
        else if(variable === "faculties")
            facultyArrayChangeCallbacks.push(callback);
        else if(variable === "rooms")
            roomsArrayChangeCallbacks.push(callback);
        else if(variable === "notifications")
            notificationsArrayChangeCallbacks.push(callback);
        else if(variable === "event.students")
        	studentEventArrayChangeCallbacks.push(callback);
        else if(variable === "connection")
            connectionChangeCallbacks.push(callback);
        else if(variable === "close")
            closeCallbacks.push(callback)
    };

    this.send = function(data, callback) {
        var code = generateID(5);
        request_map.set(code, callback);
        data["meta"] = {"request_code": code, "timestamp": Date.now()};
        socket.send(data);
    };

    this.connect  = function(username, password) {
        this.send(
            {
                tag: "auth",
                type: "signin",
                data: {
                    type: "faculty",
                    username: username,
                    password: password
                }
            },
            function(response) {
                if(response.data.status === SERVER_CONSTANTS.USER_VERIFIED || response.data.status === SERVER_CONSTANTS.CLASS_ACTIVE)
                {
                    context.connection.username = username;
                    context.connection.verified = true;
                    if(response.data.status === SERVER_CONSTANTS.CLASS_ACTIVE)
                    {
                        context.connection.active_room = response.data.room_id;
                        context.connection.active_course = response.data.course_code;
                    }
                    context.send(
                        {
                            tag: "request.get",
                            type: "fields",
                            data: {
                                fields: ["notifications","rooms","students"]
                            }
                        },
                        function(message) {
                            console.log(message);
                            for(var key in message.data)
                            {
                                if(message.data.hasOwnProperty(key))
                                {
                                    if(context.hasOwnProperty(key))
                                    {
                                        context[key].splice(0, context[key].length);
                                        Array.prototype.push.apply(context[key], message.data[key]);
                                    }
                                }
                            }
                        }
                    );
                }
            }
        );
    };

    this.refresh = function() {
        socket.refresh();
    };
    this.close = function () {
        this.connectionChangeCallbacks = [];
        socket.connection.close();
        for(var i=0; i < closeCallbacks.length; i++)
                closeCallbacks[i]();
    };
};

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};