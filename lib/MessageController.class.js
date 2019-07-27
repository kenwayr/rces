'use strict';

const Map = require('collections/map');
const http = require('http');
const Email = require('email-templates')

module.exports = class MessageController {
    constructor() {
        this.controls = new Map();
    }

    AddControl(control_id, {callback = (d) => {}, validations = {} }) {
        this.controls.set(control_id, { callback: callback, validations: validations });
    }

    RemoveControl(control_id) {
        this.controls.delete(control_id);
    }

    static _CheckRequirementTree(requirements, message) {
        var ob = message;
        for(var j=0; j < requirements.length; j++) {
            if(ob.hasOwnProperty(requirements[j]))
                ob = ob[ requirements[j] ];
            else 
                return false;
        }
        return true;
    }

    Eval(connection, message) {
        if(!message.hasOwnProperty('tag')) {
            Logger.Error("Message has no tag: " + message.toString());
            return;
        }

        var control = this.controls.get(message.tag);
        
        if(control.validations.hasOwnProperty('required')) {
            for(var i=0; i < control.validations.required.length; i++) {
                var requirementTree = control.validations.required[i].split(".");
                if(!MessageController._CheckRequirementTree(requirementTree, message)) {
                    Logger.Error("Message does not meet tag requirements: " + message.toString());
                    return;
                }
            }
        }

        if(control.validations.hasOwnProperty("conditional")) {
            for(var i=0; i < control.validations.conditional.length; i++) {
                var when = control.validations.conditional[i].when;
                var then = control.validations.conditional[i].then;
                if(typeof(then) === "string") {
                    if(!MessageController._CheckRequirementTree(when, message))
                        continue;
                    else if(MessageController._CheckRequirementTree(then, message))
                        continue;
                    else {
                        Logger.Error("Message does not meet tag requirements: " + message.toString());
                        return;
                    }
                }
                else {
                    if(MessageController._CheckRequirementTree(when, message)) {
                        for(var j=0; j < then.length; j++) {
                            if(!MessageController._CheckRequirementTree(then[j], message)) {
                                Logger.Error("Message does not meet tag requirements: " + message.toString());
                                return;
                            }
                        }
                    }
                }
            }
        }

        control.callback(connection, message);
    }

    static SendMessage({connection, message, template}) {
        var finalMessage = message;
        if(template.hasOwnProperty('tag'))
            finalMessage['tag'] = template.tag;
        if(template.hasOwnProperty('meta')) {
            finalMessage['meta'] = template['meta'];
            if(template.meta.hasOwnProperty('timestamp'))
                finalMessage.meta.timestamp = Date.now();
        }

        connection.send(JSON.stringify(finalMessage));
    }

    static HasFields(message, fields) {
        for(var i=0; i < fields.length; i++) {
            var parts = fields[i].split(".");
            var ob = message;
            for(var j=0; j < parts.length; j++) {
                if(ob.hasOwnProperty(parts[j]))
                    ob = ob[parts[j]];
                else
                    return false;
            }
        }
        return true;
    }

    static SendOTP(number) {
        var otp = Math.floor(100000 + Math.random() * 900000);
        var text = "<#> Your RCES verification code - " + otp + "\nDon't share this code with others\n7tt0I6QOOSD";
        http.get('http://api.smsbazar.in/sms/1/text/query?username=csehci&password=O4qE4bMY&from=RCES&to=' + number + '&text=' + urlencode.encode(text) + '&type=longSMS');
        return otp;
    }

    static SendEmail(email_id, {name = 'good folk', link = 'https://none.com?id=none'}) {
        var otp = Math.floor(100000 + Math.random() * 900000);
        var email = new Email({
            message: {
                from: "rces@noreply.com"
            },
            transport: {
                jsonTransport: true
            }
        });
        email.send({
            template: 'otp',
            message: {
                to: email_id
            },
            locals: {
                name: name,
                otp: otp,
                link: link + "?u=" + name + "&t=" + otp
            }
        });
        return otp;
    }
}