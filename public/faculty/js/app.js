
vex.defaultOptions.className = 'vex-theme-os';

var CentralBus = new Vue();

var isSSLEncrypted = (location.protocol === 'https:' ? true : false);

var app = new Vue({
    el: '#app',
    components: {
        dashboard: {
            template: '#dashboard-template',
            props: ['records'],
            data () {
                return {
                    session: {
                        course: null,
                        room: null,
                        start: null,
                        end: null,
                        events: [],
                        active: false,
                        toggleButtonText: 'PAUSE',
                        sessionToken: null,
                        recorder: null
                    },
                    waver: null,
                    roomViewer: null,
                    students: new Map(),
                    sessionList: [],
                    currentTime: Date.now(),
                    timer: null
                }
            },
            computed: {
                computedCurrentTime () {
                    var diff = new Date(this.currentTime - this.session.start);
                    return this.pad(diff.getUTCHours(), 2) + ':' + this.pad(diff.getUTCMinutes(),2) + ':' + this.pad(diff.getUTCSeconds(),2);
                },
                computedDoubtCount () {
                    return this.session.events.filter((v) => v.type === "doubt").length;
                },
                computedRepeatCount () {
                    return this.session.events.filter((v) => v.type === "repeat").length;
                },
                computedExplainCount () {
                    return this.session.events.filter((v) => v.type === "explain").length;
                },
                computedClearCount () {
                    return this.session.events.filter((v) => v.type === "clear").length;
                }
            },
            methods: {
                activeDeviceCount () {
                    var count = 0;
                    for([key,value] of this.students) {
                        if(value.active)
                            count++;
                    }
                    return count;
                },
                pad(n, width, z) {
                    z = z || '0';
                    n = n + '';
                    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
                },
                format(object) {
                    if(object.hasOwnProperty('Date') && object.hasOwnProperty('Month') && object.hasOwnProperty('Year'))
                        return this.pad(object.Date, 2) + '/' + this.pad(object.Month, 2) + '/' + object.Year;
                    else if(object.hasOwnProperty('Hours') && object.hasOwnProperty('Minutes') && object.hasOwnProperty('Seconds'))
                        return object.Hours + ':' + this.pad(object.Minutes, 2) + ':' + this.pad(object.Seconds, 2);
                },
                LoadCourses () {
                    CentralBus.$emit('update.courses')
                },
                LoadRooms () {
                    CentralBus.$emit('update.rooms')
                },
                StartSession () {
                    this.session.active = true;
                    navigator.mediaDevices.getUserMedia({audio: true, video: false}).then((stream) => {
                        CentralBus.$emit('start.session', { course: this.session.course, room: this.session.room });
                        this.session.recorder = new MediaRecorder(stream);
                        this.session.start = Date.now();
                        this.currentTime = Date.now();
                        this.timer = setInterval(() => {
                            this.currentTime = Date.now();
                        }, 1000);
                        this.waver = new Waver(this.$refs.WaveCanvas, stream);
                        this.waver.play();
                        this.session.recorder.start(50);
                        this.roomViewer = new RoomView(this.$refs.RoomView, {
                            occupiedSrc: '../common/assets/icons/device.svg',
                            emptySrc: '../common/assets/icons/seat.svg'
                        });
                        this.roomViewer.Init().then(() => {
                            this.roomViewer.ImportSeatMatrix(this.session.room.seat_matrix);
                        });
                    }).catch((e) => console.log(e));
                },
                ToggleWaveState() {
                    if(this.waver.state === this.waver.PLAYING) {
                        this.waver.pause();
                        this.session.toggleButtonText = 'PLAY';
                    } else if(this.waver.state === this.waver.PAUSED) {
                        this.waver.play();
                        this.session.toggleButtonText = 'PAUSE';
                    }
                },
                AddRegion(region) {
                    if(this.session.active) {
                        this.waver.addRegion(region);
                    }
                },
                EndSession () {
                    clearInterval(this.timer);
                    this.session.active = false;
                    if(this.session.sessionToken !== null)
                        CentralBus.$emit('stop.session', {});
                    this.session.recorder.stop();
                    this.GetSesssions();
                },
                GetSesssions () {
                    CentralBus.$emit('get.sessions');
                },
                Export(session) {
                    var studentData = DataManager.ExtractStudentData(session);
                    var csv = DataManager.ToCSV({map: studentData});
                    var encoded = encodeURI("data:text/csv;charset=utf-8," + csv);
                    var link = document.createElement("a");
                    link.setAttribute("href", encoded);
                    link.setAttribute("download", "data.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            },
            created () {
                CentralBus.$on('event.student', (event) => {
                    this.session.events.push(event);
                    var colors = {
                        doubt: 'rgba(0, 0, 255, 0.6)',
                        repeat: 'rgba(0, 255, 0, 0.6)',
                        explain: 'rgba(255, 0, 0, 0.6)'
                    };
                    if(colors.hasOwnProperty(event.type)) {
                        var region = {
                            fillStyle: colors[event.type],
                            timestamp: event.timestamp || Date.now()
                        };
                        this.AddRegion(region);
                    }

                    if(event.type === "join") {
                        this.students.set(event.number, { number: event.number, seat: event.seat, active: true });
                        console.log(this.students);
                        this.roomViewer.SetStatus(event.seat.row, event.seat.col, 2);
                    }
                    else if(event.type === "app.foreground") {
                        console.log(event);
                        var record = this.students.get(event.number);
                        record.active = true;
                        this.students.set(record.number, record);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 2);
                    }
                    else if(event.type === "app.background") {
                        console.log(event);
                        var record = this.students.get(event.number);
                        record.active = false;
                        this.students.set(record.number, record);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 1);
                    }
                    else if(event.type === "doubt") {
                        var record = this.students.get(event.number);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 3);
                    }
                    else if(event.type === "repeat") {
                        var record = this.students.get(event.number);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 4);
                    }
                    else if(event.type === "explain") {
                        var record = this.students.get(event.number);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 5);
                    }
                    else if(event.type === "clear") {
                        var record = this.students.get(event.number);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 2);
                    }
                });
            },
            mounted () {
                CentralBus.$emit('update.courses');
                CentralBus.$emit('update.rooms');
                CentralBus.$on('set.token', (token) => {
                    this.session.sessionToken = token;
                    this.session.recorder.ondataavailable = (e) => {
                        var data = new FormData();
                        data.append("token", this.session.sessionToken);
                        data.append("type", "chunk");
                        data.append("file", e.data);
                        axios.post('/upload', data);
                    };
                });
                CentralBus.$on('set.sessions', (sessions) => {
                    this.sessionList = sessions;
                });
                CentralBus.$on('login.done', () => {
                    this.GetSesssions();
                });
                this.GetSesssions();
            }
        },
        courseManager: {
            template: '#course-manager-template',
            props: ['records'],
            data () {
                return {
                    code: null,
                    title: null,
                    start: null,
                    remarks: null
                }
            },
            methods: {
                OnCreateCourse() {
                    CentralBus.$emit('add.course', { code: this.code, title: this.title, start: this.start, remarks: this.remarks });
                }
            }
        },
        analytics: {
            template: '#analytics-template',
            props: ['records'],
            data () {
                return {
                    sessions: [],
                    sessionAnalysisData: {
                        recording: null,
                        date: null,
                        students: [],
                        focus: {
                            name: '',
                            roll_number: '',
                            events: [],
                            number: '',
                            gender: ''
                        }
                    },
                    activeState: 'list',
                    waveforms: {
                        session: null,
                        focused: null
                    }
                };
            },
            methods: {
                GetSesssions () {
                    CentralBus.$emit('get.sessions');
                },
                pad(n, width, z) {
                    z = z || '0';
                    n = n + '';
                    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
                },
                format(object) {
                    if(object.hasOwnProperty('Date') && object.hasOwnProperty('Month') && object.hasOwnProperty('Year'))
                        return this.pad(object.Date, 2) + '/' + this.pad(object.Month, 2) + '/' + object.Year;
                    else if(object.hasOwnProperty('Hours') && object.hasOwnProperty('Minutes') && object.hasOwnProperty('Seconds'))
                        return object.Hours + ':' + this.pad(object.Minutes, 2) + ':' + this.pad(object.Seconds, 2);
                },
                LinearRegression(x,y){
                    var lr = {};
                    var n = y.length;
                    var sum_x = 0;
                    var sum_y = 0;
                    var sum_xy = 0;
                    var sum_xx = 0;
                    var sum_yy = 0;
            
                    for (var i = 0; i < y.length; i++) {
            
                        sum_x += x[i];
                        sum_y += y[i];
                        sum_xy += (x[i]*y[i]);
                        sum_xx += (x[i]*x[i]);
                        sum_yy += (y[i]*y[i]);
                    } 
            
                    lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);
                    lr['intercept'] = (sum_y - lr.slope * sum_x)/n;
                    lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);
            
                    return lr;
                },
                DrawLinearChart(x, y, label, data, ref, themeColor='#2196f3') {
                    var regressionLine = this.LinearRegression(data[x], data[y]);

                    var chart = new Chart(ref, {
                        type: 'scatter',
                        data: {
                            datasets: [
                                {
                                    label: 'Regression Line',
                                    data: [{
                                        x: 0,
                                        y: regressionLine.intercept
                                    },
                                    {
                                        x: data.max[x],
                                        y: data.max[x] * regressionLine.slope + regressionLine.intercept
                                    }],
                                    type: 'line',
                                    pointBackgroundColor: '#1c1c1c',
                                    borderColor: '#1c1c1c',
                                    showLine: true
                                },
                                {
                                    label: label,
                                    data: data.repeat.map((v, i) => { return { y: v, x: data[y][i] }; } ),
                                    backgroundColor: themeColor
                                }
                            ]
                        },
                        options: {
                            scales: {
                                xAxes: [{
                                    type: 'linear',
                                    position: 'bottom'
                                }]
                            }
                        }
                    });
                    CentralBus.$on('re.analyse', () => {
                        chart.destroy();
                    });
                },
                DrawPieChart(type, map, ref) {
                    var data = [], labels = [], bgs=[];
                    for([key,value] of map) {
                        data.push(value[type]);
                        labels.push(value['roll_number'] + ' (' + key + ')');
                    }
                    for(var i=1; i <= data.length; i++) {
                        bgs.push('rgb(' + 255*Math.random() + ', ' + 255*Math.random() +', ' + 255*Math.random() +')');
                    }
                    console.log(data,labels);
                    var chart = new Chart(ref, {
                        type: 'pie',
                        data: {
                            datasets: [{
                                data: data,
                                backgroundColor: bgs
                            }],
                            labels: labels
                        },
                        options: {
                            legend: {
                                display: false
                            }
                        }
                    });
                    CentralBus.$on('re.analyse', () => {
                        chart.destroy();
                    });
                },
                DrawRadarChart(labels, data, ref) {
                    var chart = new Chart(ref, {
                        type: 'radar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: "Comparison",
                                data: data,
                                fill: true,
                                backgroundColor: 'rgba(50, 98, 168, 0.5)'
                            }]
                        }
                    });
                    CentralBus.$on('re.focus', () => {
                        chart.destroy();
                    });
                },
                Analyse(session) {
                    var studentData = DataManager.ExtractStudentData(session);
                    var numbers = Array.from(studentData.keys());

                    var regions = [];

                    for(var i=0,fg=0; i < session.events.length; i++) {
                        var start = (session.events[i].timestamp - session.date.start.UTCTimestampMillis) / 1000;
                        if(session.events[i].type === 'doubt') {
                            regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(0, 0, 255, 0.8)' })
                        }
                        else if(session.events[i].type === 'repeat') {
                            regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(0, 255, 0, 0.8)' })
                        }
                        else if(session.events[i].type === 'explain') {
                            regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(255, 0, 0, 0.8)' })
                        }
                    }

                    if(this.waveforms.session)
                        this.waveforms.session.destroy();
                    var wavesurfer = WaveSurfer.create({
                        container: this.$refs.sessionAudioWaveform,
                        waveColor: '#A8DBA8',
                        progressColor: '#3B8686',
                        backend: 'MediaElement',
                        plugins: [
                            WaveSurfer.regions.create({
                                regions: regions
                            })
                        ]
                    });
                    wavesurfer.load("../resource?id=" + session.recording + "&a=stream");
                    this.waveforms.session = wavesurfer;

                    CentralBus.$emit('update.students', {}, () => {
                        
                        for(var i=0; i < this.records.students.length; i++) {
                            if(numbers.includes(this.records.students[i].number)) {
                                studentData.get(this.records.students[i].number).name = this.records.students[i].name;
                                studentData.get(this.records.students[i].number).roll_number = this.records.students[i].roll_number;
                                studentData.get(this.records.students[i].number).gender = this.records.students[i].gender;
                            }
                        }
                        
                        this.sessionAnalysisData.recording = session.recording;
                        this.sessionAnalysisData.students = Array.from(studentData.values());
                        this.sessionAnalysisData.date = session.date;

                        console.log(this.sessionAnalysisData.students);

                        var data = {
                            doubt: [],
                            repeat: [],
                            explain: [],
                            clear: [],
                            max: {
                                doubt: 0,
                                repeat: 0,
                                explain: 0,
                                clear: 0
                            }
                        };
                        
                        for([key, value] of studentData) {
                            data.doubt.push(value.doubt);
                            data.repeat.push(value.repeat);
                            data.explain.push(value.explain);
                            data.clear.push(value.clear);
                        }
    
                        data.max.doubt = Math.max.apply(null, data.doubt);
                        data.max.repeat = Math.max.apply(null, data.repeat);
                        data.max.explain = Math.max.apply(null, data.explain);
                        data.max.clear = Math.max.apply(null, data.clear);
    
                        CentralBus.$emit('re.analyse');
    
                        this.DrawLinearChart('repeat', 'doubt', 'Repeat vs Doubt', data, this.$refs.repeatDoubtChart);
                        this.DrawLinearChart('explain', 'doubt', 'Explain vs Doubt', data, this.$refs.explainDoubtChart, '#fcad03');
                        this.DrawLinearChart('clear', 'doubt', 'Clear vs Doubt', data, this.$refs.clearDoubtChart, '#03fc45');
                        this.DrawLinearChart('clear', 'repeat', 'Clear vs Repeat', data, this.$refs.clearRepeatChart, '#9803fc');
                        this.DrawLinearChart('explain', 'repeat', 'Explain vs Repeat', data, this.$refs.explainRepeatChart, '#fc5a03');
                        this.DrawLinearChart('explain', 'clear', 'Explain vs Clear', data, this.$refs.explainClearChart, '#fc0303');
                        
                        this.DrawPieChart('doubt', studentData, this.$refs.doubtPieChart);
                        this.DrawPieChart('repeat', studentData, this.$refs.repeatPieChart);
                        this.DrawPieChart('explain', studentData, this.$refs.explainPieChart);
                        this.DrawPieChart('clear', studentData, this.$refs.clearPieChart);

                        this.activeState = 'overview';
                    });
                },
                FocusedAnalysis(student) {

                    CentralBus.$emit('re.focus');

                    if(this.waveforms.session)
                        this.waveforms.session.stop();

                    this.sessionAnalysisData.focus = student;

                    var regions = [];

                    for(var i=0,fg=0; i < student.events.length; i++) {
                        if(student.events[i].type === 'app.foreground') {
                            fg = student.events[i].timestamp;
                        }
                        else if(student.events[i].type === 'app.background') {
                            regions.push({ start: (fg - this.sessionAnalysisData.date.start.UTCTimestampMillis) / 1000, end: (student.events[i].timestamp - this.sessionAnalysisData.date.start.UTCTimestampMillis) / 1000, drag: false, color: 'rgba(63, 129, 235, 0.4)' });
                        }
                        else {
                            var start = (student.events[i].timestamp - this.sessionAnalysisData.date.start.UTCTimestampMillis) / 1000;
                            if(student.events[i].type === 'doubt') {
                                regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(0, 0, 255, 0.8)' })
                            }
                            else if(student.events[i].type === 'repeat') {
                                regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(0, 255, 0, 0.8)' })
                            }
                            else if(student.events[i].type === 'explain') {
                                regions.push({ start: start, end: start + 10, drag: false, color: 'rgba(255, 0, 0, 0.8)' })
                            }
                        }
                    }

                    console.log(regions);

                    if(this.waveforms.focused)
                        this.waveforms.focused.destroy();
                    var wavesurfer = WaveSurfer.create({
                        container: this.$refs.focusedAudioWaveform,
                        waveColor: '#A8DBA8',
                        progressColor: '#3B8686',
                        backend: 'MediaElement',
                        plugins: [
                            WaveSurfer.regions.create({
                                regions: regions
                            })
                        ]
                    });
                    wavesurfer.load("../resource?id=" + this.sessionAnalysisData.recording + "&a=stream");
                    this.waveforms.focused = wavesurfer;

                    this.DrawRadarChart(["Doubt", "Repeat", "Explain", "Clear"], [student.doubt, student.repeat, student.explain, student.clear], this.$refs.focusedRadarChart);

                    this.activeState = 'focused';
                },
                ToggleSessionWaveform() {
                    if(this.waveforms.session)
                        this.waveforms.session.playPause();
                },
                ToggleFocusedWaveform() {
                    if(this.waveforms.focused)
                        this.waveforms.focused.playPause();
                },
                HideAnalysis() {
                    if(this.waveforms.session)
                        this.waveforms.session.stop();
                    this.activeState = 'list';
                },
                HideFocusedAnalysis() {
                    if(this.waveforms.focused)
                        this.waveforms.focused.stop();
                    this.activeState = 'overview';
                }
            },
            mounted() {
                CentralBus.$on('set.sessions', (sessions) => {
                    this.sessions = sessions;
                });
                this.GetSesssions();
            }
        },
        settings: {
            template: '#settings-template',
            props: ['self'],
            data () {
                return {

                };
            },
            methods: {
                uploadPhoto () {
                    var file = document.createElement('input');
                    file.type = 'file';
                    file.value = '';
                    file.addEventListener("change", (e) => {
                        console.log(e);
                        var data = new FormData();
                        data.append("type", "dp");
                        data.append("file", file.files[0]);
                        axios.post('/upload', data).then((response) => {
                            var id = response.data.id;
                            CentralBus.$emit("set.me", { $set: { dp: id } });
                        });
                    }, false);
                    file.click();
                }
            },
            computed: {

            },
            created () {

            },
            mounted () {

            }
        }
    },
    data: {
        title: "Dashboard",
        currentTab: 'dashboard',
        socket: new Socket(isSSLEncrypted), // change to true on production
        tabs: [
            {
                title: "Dashboard",
                icon: "dashboard",
                link: "dashboard"
            },
            {
                title: "Course Manager",
                icon: "records",
                link: "courseManager"
            },
            {
                title: "Analytics",
                icon: "analytics",
                link: "analytics"
            },
            {
                title: "Settings",
                icon: "settings",
                link: "settings"
            }
        ],
        dynamicData: {
            self: {
                username: null,
                dp: null
            },
            notification: {
                active: false,
                list: [
                    { text: "Lorem Ipsum dolor sit amet vis a vis consecteur de la wozniak", icon: "dashboard", timestamp: Date.now() },
                    { text: "My little pony 2", timestamp: Date.now() - (55 * 1000) }
                ]
            },
            clients: {
                student: new Map()
            },
            records: {
                students: [],
                rooms: [],
                courses: []
            }
        }
    },
    methods: {
        findTime: function (timestamp) {
            var timegap = (Date.now() - timestamp) / 1000;
            if(timegap < 60)
                return 'Just now';
            else if(timegap < 60 * 60)
                return parseInt(timegap / 60) + ' min ago';
            else if(timegap < 24 * 60 * 60)
                return parseInt(timegap / (60 * 60)) + 'hrs ago';
            else
                return parseInt(timegap / (24 * 60 * 60)) + 'days ago';
        },
        tabClick: function (tab, flag = true) {
            console.log(tab.link || "none", flag);
            if(flag && tab.children)
                tab.active = !tab.active;
            if(tab.link)
                this.currentTab = tab.link; 
        },
        prompt(
            {
                message='',
                fields=[],
                buttons={confirmText: 'Confirm', cancelText: 'Cancel'},
                escapeButtonCloses=true,
                showCloseButton=true,
                overlayClosesOnClick=false,
                callback = (d) => {}
            }
        ) {

            var inputs = [];
            for(var i=0; i < fields.length; i++) {
                if(fields[i].type === 'text' || fields[i].type === 'password')
                    inputs.push(
                        '<input name="' + fields[i].name +
                        '" type="' + fields[i].type + '" placeholder="'+ (fields[i].placeholder || "") +
                        '" ' + (fields[i].required ? 'required' : '') +' />'
                    );
            }

            var buttons = [Object.assign(vex.dialog.buttons.YES, { text: buttons.confirmText })];
            if(buttons.cancelText)
                buttons.push(Object.assign(vex.dialog.buttons.NO, { text: buttons.cancelText }));
            
            var $instance = vex.dialog.open({
                message: message,
                input: inputs.join(''),
                buttons: buttons,
                callback: callback,
                escapeButtonCloses: escapeButtonCloses,
                showCloseButton: showCloseButton,
                overlayClosesOnClick: overlayClosesOnClick
            });
            return $instance;
        },
        confirm({message, confirmText='Confirm', cancelText='Cancel'}, callback = (d) => {}) {
            vex.dialog.confirm({
                message: message,
                buttons: [
                    Object.assign(vex.dialog.buttons.YES, {text: confirmText}),
                    Object.assign(vex.dialog.buttons.NO, {text: cancelText})
                ],
                callback: callback
            });
        },
        alert(message) {
            vex.dialog.alert({
                message: message,
                buttons: [
                    Object.assign(vex.dialog.buttons.YES, {text: 'OK'})
                ]
            });
        },
        update(property) {
            this.dynamicData[property] = Object.create(this.dynamicData[property]);
        }
    },
    created () {
        CentralBus.$on('update.students', (filters = null, callback = () => {}) => {
            console.log("Updating");
            if(filters)
                this.socket.Get("students", filters, (message) => {
                    this.dynamicData.records.students = message.data;
                    this.update('records');
                    callback();
                });
            else
                this.socket.Get("students", {}, (message) => {
                    this.dynamicData.records.students = message.data;
                    this.update('records');
                    callback();
                });
        });
        CentralBus.$on('add.course', (data) => {
            this.socket.Add('course', data, (message) => {
                if(message.data.created)
                    this.alert('Course added - ' + data.code);
            });
        });
        CentralBus.$on('update.courses', () => {
            this.socket.Get('courses', {}, (message) => {
                console.log(message.data, this.dynamicData.records.courses);
                this.dynamicData.records.courses = message.data;
                this.update('records');
            });
        });
        CentralBus.$on('update.rooms', () => {
            this.socket.Get('rooms', {}, (message) => {
                console.log(message.data, this.dynamicData.records.rooms);
                this.dynamicData.records.rooms = message.data;
                this.update('records');
            });
        });
        CentralBus.$on('start.session', (data) => {
            this.socket.StartSession(data, (message) => {
                if(message.data.token)
                    CentralBus.$emit('set.token', message.data.token);
            });
        });

        CentralBus.$on('stop.session', (data) => {
            this.socket.StopSession(data);
        });

        CentralBus.$on('get.sessions', () => {
            this.socket.Get('sessions', {}, (message) => {
                console.log(message);
                CentralBus.$emit('set.sessions', message.data);
            })
        });

        CentralBus.$on('get.me', () => {
            this.socket.Get('me', {}, (message) => {
                this.dynamicData.self = message.data;
            });
        });

        CentralBus.$on('set.me', (data) => {
            this.socket.Set('me', data, (message) => {
                console.log(message);
                window.location.reload();
            })
        });

        this.socket.On('event.student', (message) => {
            CentralBus.$emit('event.student', message.data);
        });
    },
    mounted () {

        var LoginPromptOptions = {
            message: 'Enter your username and password',
            fields: [
                { name: "username", type: "text", placeholder: "Username", required: true },
                { name: "password", type: "password", placeholder: "Password", required: true }
            ],
            buttons: {
                confirmText: "Login",
                cancelText: "Cancel"
            },
            showCloseButton: false,
            escapeButtonCloses: false,
            overlayClosesOnClick: false,
            closeOnButtonClick: false,
            callback: (data) => {
                var username = data.username;
                var password = data.password;
                if(username.trim() !== '' && password.trim() !== '') {
                    this.socket.Login(username, password, (response) => {
                        if(response.error !== null) {
                            this.prompt(LoginPromptOptions);
                        }
                        else {
                            this.dynamicData.self.username = username;
                            CentralBus.$emit('login.done');
                            CentralBus.$emit('get.me');
                        }
                    });
                }
                else
                    this.prompt(LoginPromptOptions);
            }
        };

        this.prompt(LoginPromptOptions);
    }
})