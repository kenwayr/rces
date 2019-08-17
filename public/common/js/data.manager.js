class DataManager {
    static ExtractStudentData(data) {
        var students = new Map();
        for(var i=0; i < data.events.length; i++) {
            if(students.has(data.events[i].number)) {
                if(data.events[i].type === "doubt")
                    (students.get(data.events[i].number).doubt)++;
                else if(data.events[i].type === "explain")
                    (students.get(data.events[i].number).explain)++;
                else if(data.events[i].type === "repeat")
                    (students.get(data.events[i].number).repeat)++;
                else if(data.events[i].type === "clear")
                    (students.get(data.events[i].number).clear)++;
                else if(data.events[i].type === "app.foreground")
                    students.get(data.events[i].number)._last = data.events[i].timestamp;
                else if(data.events[i].type === "app.background")
                    students.get(data.events[i].number).time += data.events[i].timestamp - students.get(data.events[i].number)._last;
            } else if(data.events[i].type === "join")
                students.set(data.events[i].number, { doubt: 0, explain: 0, repeat: 0, clear: 0, time: 0, _last: data.events[i].timestamp });
        }
        return students;
    }
    static ToCSV({map, seperator=',', crlf = true, headers=true}) {
        var csv = '';
        var lt = crlf ? '\r\n' : '\n';
        if(headers) {
            csv = ["Number","Doubt","Explain","Repeat","Clear","Time"].join(seperator) + lt;
        }
        map.forEach((v,k) => {
            var date = new Date(v.time);
            var datestr = date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds();
            csv += '"=""' + k + '"""' + seperator + '"' + [v.doubt, v.explain, v.repeat, v.clear, datestr].join('"' + seperator + '"') + '"' + lt;
        });
        return csv;
    }
}