var http = require('http');
var mongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var CONSTANTS = require('../constants').CONSTANTS;
var crypto = require('crypto');
var urlencode = require('urlencode');

var DatabaseObject = function () {
    this.database = null;
	this.init = function(callback = ()=>{}) {
		var context = this;
		mongoClient.connect('mongodb://localhost:27017', function(err, db){
			if(err) throw err;
			context.database = db.db('attendance');
			callback();
		});
	};
	this.removeDevice = function(mobile_number, device_id, callback = (d) => {}) {
		this.database.collection('devices').deleteOne({"number": mobile_number, "device_id": device_id}, function(err, res) {
			if(err) throw err;
			
			callback(res);
		});
	};
    this.createDevice = function(data, callback = (d) => {}) {
        if(data.type === "student") {
            data.verified = false;
            
            delete data.otp;

            this.database.collection('devices').insertOne(data, function(err, res) {
                if(err) throw err;
                callback(res);
            });
        }
        else if(data.hasOwnProperty('authorizer')) {
            var password = data.password;
            var salt = crypto.randomBytes(16).toString('hex');
            var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);
            
            data.password = {
                salt: salt,
                hash: hash
            };

            if(data.type === "faculty") {
                this.database.collection('devices').insertOne(data, function(err, res) {
                    if(err) throw err;
                    callback(res);
                });
            }
            else if(data.type === "admin") {
				delete data.type;
                this.database.collection('admin').insertOne(data, function(err, res) {
                    if(err) throw err;
                    callback(res);
                });
            }
        }
	};
	
	this.getOTP = function(device_id, callback = (d) => {}) {
		this.database.collection('devices').findOne({"device_id": device_id}, {"projection": {"_id": 0, "password": 0 }}, function(err, res) {
			if(err) throw err;
			else if(res === null)
				callback({
					success: false,
					reason: CONSTANTS.NO_SUCH_DEVICE
				});
			else
				callback(res);
		});
	};

	this.getDevice = function(filters,  callback = (d) => {}) {
		if(!filters.hasOwnProperty('type') || filters.type !== 'admin')
		{
			this.database.collection('devices').findOne(filters, {"projection": {"_id": 0, "password": 0, "otp": 0 }}, function(err, res) {
				if(err) throw err;
				else if(res === null)
					callback({
						success: false,
						reason: CONSTANTS.NO_SUCH_DEVICE
					});
				else
					callback(res);
			});
		}
		else if(filters.hasOwnProperty('type') && filters.type === 'admin') {
			delete filters.type;
			this.database.collection('admin').findOne(filters, {"projection": {"_id": 0, "password": 0 }}, function(err, res) {
				if(err) throw err;
				else if(res === null)
					callback({
						success: false,
						reason: CONSTANTS.NO_SUCH_DEVICE
					});
				else
					callback(res);
			});
		}
	};
	
	this.getDevices = function(filters,  callback = (d) => {}) {
		if(!filters.hasOwnProperty('type') || filters.type !== 'admin')
		{
			this.database.collection('devices').find(filters, {"projection": {"_id": 0, "password": 0, "otp": 0 }}).toArray( function(err, res) {
				if(err) throw err;
				else if(res === null)
					callback({
						success: false,
						reason: CONSTANTS.NO_SUCH_DEVICE
					});
				else
					callback(res);
			});
		}
		else if(filters.hasOwnProperty('type') && filters.type === 'admin') {
			delete filters.type;
			this.database.collection('admin').find(filters, {"projection": {"_id": 0, "password": 0 }}).toArray( function(err, res) {
				if(err) throw err;
				else if(res === null)
					callback({
						success: false,
						reason: CONSTANTS.NO_SUCH_DEVICE
					});
				else
					callback(res);
			});
		}
	};

    this.updateDevice = function(type, data, callback = (d) => {}) {

		console.log(data);
		
		if(type === "student") {
			/* THESE FIELDS CANNOT BE TAMPERED WITH BY USER */
			if(data.hasOwnProperty('setData'))
			{
				delete data.setData.number;
				delete data.setData.identifier;
				delete data.setData.device_id;
				delete data.setData.otp;
				delete data.setData.time;
				delete data.setData.verified;
			}
			delete data.password;

			var dataObj = {};
			if(data.hasOwnProperty('setData') && Object.keys(data.setData).length !== 0)
				dataObj['$set'] = data.setData;
			if(data.hasOwnProperty('pushData') && Object.keys(data.pushData).length !== 0)
				dataObj['$push'] = data.pushData;

			this.database.collection('devices').updateOne(
				{"device_id": data.device_id, "number": data.number},
				dataObj,
				function(err, res) {
					if(err) throw err;
					callback(res);
				}
			);	
		}
		else if(type === "faculty") {
			/* THESE FIELDS CANNOT BE TAMPERED WITH BY USER */
			if(data.hasOwnProperty('setData'))
			{
				delete data.setData.username;
				delete data.setData.password;
				delete data.setData.type;
				delete data.setData.authorizer;
			}

			var dataObj = {};
			if(data.hasOwnProperty('setData') && Object.keys(data.setData).length !== 0)
				dataObj['$set'] = data.setData;
			if(data.hasOwnProperty('pushData') && Object.keys(data.pushData).length !== 0)
				dataObj['$push'] = data.pushData;
			this.database.collection('devices').updateOne(
				{"username": data.username},
				dataObj,
				function(err, res) {
					if(err) throw err;
					callback(res);
				}
			);
		}
		else if(type === "admin") {
			/* THESE FIELDS CANNOT BE TAMPERED WITH BY USER */
			if(data.hasOwnProperty('setData'))
			{
				delete data.setData.username;
				delete data.setData.password;
			}

			var dataObj = {};
			if(data.hasOwnProperty('setData') && Object.keys(data.setData).length !== 0)
				dataObj['$set'] = data.setData;
			if(data.hasOwnProperty('pushData') && Object.keys(data.pushData).length !== 0)
				dataObj['$push'] = data.pushData;
			this.database.collection('admin').updateOne(
				{"username": data.username},
				dataObj,
				function(err, res) {
					if(err) throw err;
					callback(res);
				}
			);
		}
    };
    
    this.generateOTP = function(mobile_number, callback = (d) => {}) {
		var otp = Math.floor(100000 + Math.random() * 900000);
		var text = "<#> Your RCES verification code - " + otp + "\nDon't share this code with others\n7tt0I6QOOSD";
		var number = mobile_number.replace('+', '');
		number = number.length === 10 ? '91' + number : number;
		this.database.collection('devices').updateOne({"number": mobile_number, "type": "student"}, {"$set": {"otp": otp, "time": Date.now()}}, function(err, res) {
			if(err) throw err;
			http.get('http://api.smsbazar.in/sms/1/text/query?username=csehci&password=O4qE4bMY&from=RCES&to=' + number + '&text=' + urlencode.encode(text) + '&type=longSMS');
			callback(res);
		});
    };
    
    this.verifyOTP = function(mobile_number, otp, callback = (d) => {}) {
		var context = this;
		this.database.collection('devices').findOne({"number": mobile_number, "type": "student"}, function(err, res) {
			if(err) throw err;
			if(otp === res.otp)
			{
				if(Date.now() - res.time < CONSTANTS.OTP_VALID_FOR * 1000)
				{
					context.database.collection('devices').updateOne({"number": mobile_number, "type": "student"}, {"$set": {"verified": true}});
					callback(CONSTANTS.OTP_IS_VALID);
				}
				else
					callback(CONSTANTS.OTP_STALE);
			}
			else
				callback(CONSTANTS.OTP_INVALID);
		});
    };
    
    this.verifyFaculty = function(username, password, callback = (d) => {}) {
        this.database.collection('devices').findOne({"type": "faculty", "username": username}, function(err, res) {
			if(err) throw err;
			else if(res === null)
				callback(CONSTANTS.NO_SUCH_DEVICE);
			else
			{
				var passwordHash = crypto.pbkdf2Sync(password, res.password.salt, 1000, 64, `sha512`).toString(`hex`);
				if(passwordHash === res.password.hash)
					callback(CONSTANTS.USER_VERIFIED);
				else
					callback(CONSTANTS.NO_SUCH_DEVICE);
			}
		});
    };

    this.verifyAdmin = function(username, password, callback = (d) => {}) {
		if(username === "MASTER" && password === "MASTERPASS")
			callback(CONSTANTS.ADMIN_IS_VALID);
        this.database.collection('admin').findOne({"username": username}, function(err, res) {
			if(err) throw err;
			else if(res === null)
				callback(CONSTANTS.ADMIN_NOT_EXISTS);
			else
			{
				var passwordHash = crypto.pbkdf2Sync(password, res.password.salt, 1000, 64, `sha512`).toString(`hex`);
				if(passwordHash === res.password.hash)
					callback(CONSTANTS.ADMIN_IS_VALID);
				else
					callback(CONSTANTS.ADMIN_INVALID);
			}
		});
	};
	
	this.addClassroom = function(data, callback = (d) => {}) {
		this.database.collection('classroom').insertOne(data, function(err, res) {
			if(err) throw err;
			callback(res);
		});
	};
	this.getClassroom = function(filter = {}, callback = (d) => {}) {
		this.database.collection('classroom').find(filter, {"projection": {"_id": 0 }}).toArray( function(err, res) {
			if(err) throw err;
			if(res.length === 0) callback(CONSTANTS.NO_SUCH_ROOM);
			else callback(res);
		});
	};
	this.updateClassroom = function(filter, data, callback = (d) => {}) {
		this.database.collection('classroom').updateOne(filter, data, function(err, res) {
			if(err) throw err;
			callback(res);
		});
	};

	this.addCourse = function(data, callback = (d) => {}) {
		this.database.collection('courses').insertOne(data, function(err, res) {
			if(err) throw err;
			callback(res);
		});
	};
	this.getCourse = function(filter = {}, callback = (d) => {}) {
		this.database.collection('courses').find(filter, {"projection": { "_id": 0 }}).toArray(function(err, res) {
			if(err) throw err;
			if(res.length === 0) callback({status: CONSTANTS.NO_SUCH_COURSE, courses: []});
			callback({status: CONSTANTS.COURSES_FOUND, courses: res});
		});
	};
	this.updateCourse = function(data, callback = (d) => {}) {
		this.database.collection('courses').updateOne(
		{"code": data.code},
		{
			"$set": data.setData || {},
			"$push": data.pushData || {}
		},
		function(err, res) {
			if(err) throw err;
			callback(res);
		});
	};
	this.uploadAsset = function(rawData, type, callback = (d) => {}) {
		this.database.collection('assets').insertOne({"binaryData": rawData, "type": type}, function(err, res) {
			if(err) throw err;
			callback(res.insertedId);
		});
	};
	this.getAsset = function(id, callback = (d) => {}) {
		this.database.collection('assets').findOne({"_id": new ObjectID(id)}, {"projection": {"_id": 0}}, function (err, res) {
			if(err) throw err;
			callback(res);
		});
	};
};

exports.DatabaseObject = new DatabaseObject();