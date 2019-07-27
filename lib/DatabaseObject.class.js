'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const crypto = require('crypto');

module.exports = class DatabaseObject {
    constructor({hostname, port, database, accounts = 'accounts', students = 'students', courses = 'courses', rooms = 'rooms', sessions = 'sessions'}) {
        this.db = {
            config: {
                hostname: hostname,
                port: port,
                database: database,
                accounts: accounts,
                students: students,
                courses: courses,
                rooms: rooms,
                sessions: sessions
            },
            instance: null,
            collections: {
                accounts: null,
                students: null,
                courses: null,
                rooms: null,
                sessions: null
            }
        };
    }

    async Init() {
        // var mongodb = await MongoClient.connect("mongodb://" + this.db.config.hostname + ":" + this.db.config.port, {useNewUrlParser: true});
        var mongodb = await MongoClient.connect("mongodb+srv://root:sagnikmodak98@clusterrces-6ol28.gcp.mongodb.net/test?retryWrites=true&w=majority");
        this.db.instance = mongodb.db(this.db.config.database);

        this.db.collections.accounts = this.db.instance.collection(this.db.config.accounts);
        this.db.collections.students = this.db.instance.collection(this.db.config.students);
        this.db.collections.courses = this.db.instance.collection(this.db.config.courses);
        this.db.collections.rooms = this.db.instance.collection(this.db.config.rooms);
        this.db.collections.sessions = this.db.instance.collection(this.db.config.sessions);
    }
    
    async CreateAccount({ type = 'faculty', username, password, authorizer = null, email = null, phone = null }) {
        var salt = crypto.randomBytes(16).toString('hex');
        var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);
        var data = {
            type: type,
            username: username,
            password: {
                salt: salt,
                hash: hash
            }
        };
        if(authorizer !== null)
            data['authorizer'] = authorizer;
        if(email !== null)
            data['email'] = email;
        if(phone !== null)
            data['phone'] = phone;
        var res = await this.db.collections.accounts.insertOne(data);
        return res.insertedId;
    }

    async CreateStudent({ device_id, number, identifier = null, fullname = null, email = null, gender = "U", grade = "", address = {}, dob = {}, courses = []}) {
        var data = arguments[0];
        data.verified = false;
        var res = await this.db.collections.students.insertOne(data);
        return res.insertedId;
    }

    async UpdateStudent(device_id, updates) {
        if(updates.$set.device_id)
            delete updates.$set.device_id;
        if(updates.$set.number)
            delete updates.$set.number;
        
        var res = await this.db.collections.students.updateOne({device_id: device_id}, updates);
        return res;
    }

    async GetStudent({number}) {
        var student = await this.db.collections.students.findOne({number: number});
        return student;
    }

    async CreateRoom({room_id, is_available = false, seat_matrix = [], capacity = 0, creator}) {
        var data = arguments[0];
        var res = await this.db.collections.rooms.insertOne(data);
        return res.insertedId;
    }

    async CreateCourse({code, title, parent = null, start_year = 0, capacity = 0, remarks = ""}) {
        var data = arguments[0];
        var res = await this.db.collections.courses.insertOne(data);
        return res.insertedId;
    }

    async GetAccount({ type = 'faculty', username, password }) {
        var account = await this.db.collections.accounts.findOne({"type": type, "username": username});
        var hash = crypto.pbkdf2Sync(password, account.password.salt, 1000, 64, `sha512`).toString(`hex`);
        if(account.password.hash === hash) {
            delete account.password;
            return account;
        } else
            return null;
    }
}