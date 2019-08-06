
vex.defaultOptions.className = 'vex-theme-os';

var CentralBus = new Vue();

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
                }
            },
            methods: {
                pad(n, width, z) {
                    z = z || '0';
                    n = n + '';
                    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
                },
                LoadCourses () {
                    CentralBus.$emit('update.courses')
                },
                LoadRooms () {
                    CentralBus.$emit('update.rooms')
                },
                StartSession () {
                    this.session.active = true;
                    navigator.mediaDevices.getUserMedia({audio: true, video: false}, (stream) => {
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
                            occupiedSrc: './assets/icons/device.svg',
                            emptySrc: './assets/icons/seat.svg'
                        });
                        this.roomViewer.Init().then(() => {
                            this.roomViewer.ImportSeatMatrix(this.session.room.seat_matrix);
                        });
                    }, (e) => console.log(e));
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
                        this.roomViewer.SetStatus(event.seat.row, event.seat.col, 2);
                    }
                    else if(event.type === "app.foreground") {
                        var record = this.students.get(event.number);
                        record.active = true;
                        this.students.set(record.number, record);
                        this.roomViewer.SetStatus(record.seat.row, record.seat.col, 2);
                    }
                    else if(event.type === "app.background") {
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
        }
    },
    data: {
        title: "Dashboard",
        currentTab: 'dashboard',
        socket: new Socket(true), // change to true on production
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
            }
        ],
        dynamicData: {
            self: {
                username: null
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
        CentralBus.$on('update.students', () => {
            this.socket.Get("students", {}, (message) => {
                this.dynamicData.records.students = message.data;
                this.update('records');
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
        })

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