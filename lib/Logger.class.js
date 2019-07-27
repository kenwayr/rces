'use strict';
const fs = require('fs');

var Logger = {
    channels: {
        info: fs.createWriteStream("./public/logs/info.txt", {flags: 'a'}),
        warning: fs.createWriteStream("./public/logs/warnings.txt", {flags: 'a'}),
        error: fs.createWriteStream("./public/logs/errors.txt", {flags: 'a'})
    },
    Info(info) {
        // console.info(info);
        Logger.channels.info.write("[ " + new Date().toString() + " ] => " + info + "\n");
    },
    Error(error) {
        // console.error(error);
        Logger.channels.error.write("[ " + new Date().toString() + " ] => " + error + "\n");
    }
}

module.exports = Logger;