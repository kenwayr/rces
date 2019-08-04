var SessionAnalytics = function () {

	var addslashes = function ( str ) {
	    return (str + '').replace(/[\\"]/g, '\\$&').replace(/\u0000/g, '\\0');
	};

	var escapeString = function ( str ) {
	    return typeof str === 'string' ? '"' + addslashes(str) + '"' : str;
	}

	var generateCallbackID = function(length) {
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		for (var i = 0; i < length; i++)
			text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
	};

	var mVariables = {};
	var mStatics = {};
	var variableHandler = {
		get: function(target, property) {
			return target[property].value;
		},
		set: function(target, property, value, receiver) {
			if(target.hasOwnProperty(property))
			{
				target[property].value = value;
				target[property].versions.push({"value": value, "timestamp": Date.now()});
				for(var i=0; i < target[property].callbacks.length; i++)
				{
					target[property].callbacks[i].fn({"value": target[property].value, "versions": target[property].versions});
				}
			}
			else
				target[property] = {"value": value, "callbacks": [], "versions": [{"value": value, "timestamp": Date.now()}]};
			return true;
		}
	};
	var staticHandler = {
		get: function(target, property) {
			return target[property].value;
		},
		set: function(target, property, value, receiver) {
			if(target.hasOwnProperty(property))
			{
				target[property].value = value;
				target[property].lastUpdateTimestamp = Date.now();
				for(var i=0; i < target[property].callbacks.length; i++)
				{
					target[property].callbacks[i].fn(target[property].value);
				}
			}
			else
				target[property] = {"value": value, "callbacks": [], "lastUpdateTimestamp": Date.now()};
			return true;
		}
	};
	this.variables = new Proxy(mVariables, variableHandler);
	this.statics = new Proxy(mStatics, staticHandler);

	this.getVersions = function (variable) {
		return mVariables[variable].versions;
	};
	this.addCallback = function (variable, callback) {
		var callbackID = generateCallbackID(15);
		while(mVariables[variable].callbacks.findIndex((v) => v.id === callbackID) !== -1)
			callbackID = generateCallbackID(15);
		mVariables[variable].callbacks.push({"id": callbackID, "fn": callback});
		return callbackID;
	};
	this.addStaticCallback = function (static, callback) {
		var callbackID = generateCallbackID(15);
		while(mVariables[static].callbacks.findIndex((v) => v.id === callbackID) !== -1)
			callbackID = generateCallbackID(15);
		mVariables[static].callbacks.push({"id": callbackID, "fn": callback});
		return callbackID;
	};
	this.removeCallback = function (variable, callbackID) {
		mVariables[variable].callbacks.splice(mVariables[variable].callbacks.findIndex((v) => v.id === callbackID), 1);
		return true;
	};
	this.removeStaticCallback = function (static, callbackID) {
		mVariables[static].callbacks.splice(mVariables[static].callbacks.findIndex((v) => v.id === callbackID), 1);
		return true;
	};
	this.export = function (additionalInfo = {}) {
		var data = additionalInfo;
		data.variables = {};
		data.statics = {};
		Object.keys(mVariables).forEach(function (key) {
			data.variables[key] = {"value": mVariables[key].value, "versions": mVariables[key].versions};
		});
		Object.keys(mStatics).forEach(function (key) {
			data.statics[key] = {"value": mStatics[key].value, "lastUpdateTimestamp": mStatics[key].lastUpdateTimestamp};
		});
		return data;
	};
};

var SessionData = function () {
	var mData = {};

	this.ConstructFromRawSA = function (raw, callback = (d) => {}) {
		mData.course = raw.statics.course.value;
		mData.room = raw.statics.room.value;

		var now = Date.now();
		var date = new Date(now);
		mData.dateTime = {
			UTCTimestampMillis: now,
			Date: date.getUTCDate(),
			Day: date.getDay(),
			Month: date.getUTCMonth(),
			Year: date.getFullYear(),
		};

		mData.studentEventLogs = raw.statics.studentEventLogs.value;

		mData.pauseTime = raw.variables.pauseTime;

		date = new Date(raw.statics.duration.value.end - raw.statics.duration.value.start);
		mData.duration = {
			StartUTCTimestamp: raw.statics.duration.value.start,
			EndUTCTimestamp: raw.statics.duration.value.end,
			Hours: date.getUTCHours(),
			Minutes: date.getUTCMinutes(),
			Seconds: date.getUTCSeconds(),
		};

		var reader = new FileReader();
		reader.onloadend = function () {
			media_rec_blob_b64 = reader.result;
			mData.mediaRecBlob = media_rec_blob_b64;

			callback(mData);
		};

		reader.readAsDataURL(raw.statics.mediaRecBlob.value);
	};

	this.ConstructFromJSON = function(data, callback = (d) => {}) {
		mData = data;

		var parts = data.mediaRecBlob.split(","), mime = parts[0].match(/:(.*?);/)[1],
        bstr = atob(parts[1]), n = bstr.length, u8arr = new Uint8Array(n);

        setTimeout(function () {
        	while(n--){
				u8arr[n] = bstr.charCodeAt(n);
			}

			mData.mediaRecBlob = new Blob([u8arr], {type:mime});

			callback(mData);
        }, 0);
	};

	this.ConstructFromJSONSync = function(data) {
		mData = data;

		var parts = data.mediaRecBlob.split(","), mime = parts[0].match(/:(.*?);/)[1],
        bstr = atob(parts[1]), n = bstr.length, u8arr = new Uint8Array(n);
    	while(n--){
			u8arr[n] = bstr.charCodeAt(n);
		}

		mData.mediaRecBlob = new Blob([u8arr], {type:mime});

		return mData;
	};

	this.getCurrentData = function () {
		return mData;
	}
};