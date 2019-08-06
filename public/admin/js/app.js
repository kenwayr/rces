
vex.defaultOptions.className = 'vex-theme-os';

var CentralBus = new Vue();

var app = new Vue({
    el: '#app',
    components: {
        dashboard: {
            template: '#dashboard-template',
            props: ['clients']
        },
        accountCreator: {
            template: '#account-creator-template',
            data () {
                return {
                    admin: {
                        username: '',
                        password: '',
                        confirmPassword: '',
                    },
                    faculty: {
                        name: '',
                        username: '',
                        password: '',
                        confirmPassword: '',
                        designation: '',
                        email: '',
                        phone: ''
                    }
                }
            },
            methods: {
                OnCreateAdmin() {
                    if(this.admin.password === this.admin.confirmPassword) {
                        CentralBus.$emit('add.admin', { username: this.admin.username, password: this.admin.password });
                        this.ResetFields();
                    }
                },
                OnCreateFaculty() {
                    if(this.faculty.password === this.faculty.confirmPassword) {
                        var data =  { username: this.faculty.username, password: this.faculty.password, designation: this.faculty.designation, email: this.faculty.email, phone: this.faculty.phone }
                        if(this.faculty.name && this.faculty.name.trim() !== '')
                            data.name = this.faculty.name.trim();
                        CentralBus.$emit('add.faculty', data);
                        this.ResetFields();
                    }
                },
                ResetFields() {
                    this.admin = {
                        username: '',
                        password: '',
                        confirmPassword: '',
                    };
                    this.faculty = {
                        username: '',
                        password: '',
                        confirmPassword: '',
                        email: '',
                        phone: ''
                    };
                }
            }
        },
        roomManager: {
            template: '#room-manager-template',
            data () {
                return {
                    code: '',
                    roomEditor: null,
                    nrows: 0,
                    ncols: 0,
                    availability: true
                }
            },
            methods: {
                OnUpdateRoomEditor() {
                    this.roomEditor = new RoomEditor(document.getElementById('RoomEditor'), {
                        activeSeatSrc: './assets/icons/seat-inverse.svg',
                        inactiveSeatSrc: './assets/icons/seat.svg'
                    });
                    this.roomEditor.Init().then(() => {
                        console.log(this.nrows, this.ncols);
                        this.roomEditor.CreateGrid(this.nrows, this.ncols);
                    });
                },
                OnCreateRoom() {
                    var capacity = this.roomEditor.matrix.reduce((a,v) => a + v.reduce((a1,v1) => a1 + (v1 ? 1 : 0), 0), 0);
                    CentralBus.$emit('add.room', { code: this.code, seat_matrix: this.roomEditor.matrix, capacity: capacity, available: this.availability })
                }
            }
        },
        facultyRecords: {
            template: '#faculty-records-template',
            props: ['records'],
            created () {
                CentralBus.$emit('update.faculties');
            }
        },
        studentRecords: {
            template: '#student-records-template',
            props: ['records'],
            created() {
                CentralBus.$emit('update.students');
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
                title: "Conduct",
                icon: "conduct",
                children: [
                    { title: "Create Accounts", icon: "account", link: "accountCreator" },
                    { title: "Manage Rooms", icon: "room", link: "roomManager" },
                    { title: "Faculty Records", icon: "records", link: "facultyRecords" },
                    { title: "Student Records", icon: "student", link: "studentRecords" }
                ],
                active: false
            },
            {
                title: "Analytics",
                icon: "analytics"
            },
            {
                title: "Settings",
                icon: "settings"
            },
            {
                title: "Report Bug",
                icon: "bug"
            },
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
                admin: new Map(),
                faculty: new Map(),
                student: new Map()
            },
            records: {
                faculties: [],
                students: [],
                rooms: []
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
        CentralBus.$on('add.admin', (data) => {
            console.log(data);
            this.socket.Add('admin', data, (message) => {
                if(message.data.created)
                    this.alert('Account for ' + data.username + ' Created Successfully');
            });
        });
        CentralBus.$on('add.faculty', (data) => {
            console.log(data);
            this.socket.Add('faculty', data, (message) => {
                if(message.data.created)
                    this.alert('Account for ' + data.username + ' Created Successfully');
            });
        });
        CentralBus.$on('update.faculties', () => {
            this.socket.Get("faculties", {}, (message) => {
                this.dynamicData.records.faculties = message.data;
                this.update('records');
            });
        });
        CentralBus.$on('update.students', () => {
            this.socket.Get("students", {}, (message) => {
                this.dynamicData.records.students = message.data;
                this.update('records');
            });
        });
        CentralBus.$on('add.room', (data) => {
            this.socket.Add('room', data, (message) => {
                if(message.data.created)
                    this.alert('Room added - ' + data.code);
            });
        });
    },
    mounted () {

        this.socket.On('update.admin', (message) => {
            if(message.data.push) {
                for(var i=0; i < message.data.push.length; i++) {
                    if(!this.dynamicData.clients.admin.has(message.data.push[i].username))
                        this.dynamicData.clients.admin.set(message.data.push[i].username, message.data.push[i]);
                }
            }
            if(message.data.pop) {
                for(var i=0; i < message.data.pop.length; i++) {
                    if(this.dynamicData.clients.admin.has(message.data.pop[i].username))
                        this.dynamicData.clients.admin.delete(message.data.pop[i].username);
                }
            }
            this.update('clients');
        });
        
        this.socket.On('update.faculty', (message) => {
            if(message.data.push) {
                for(var i=0; i < message.data.push.length; i++) {
                    if(!this.dynamicData.clients.faculty.has(message.data.push[i].username))
                        this.dynamicData.clients.faculty.set(message.data.push[i].username, message.data.push[i]);
                }
            }
            if(message.data.pop) {
                for(var i=0; i < message.data.pop.length; i++) {
                    if(this.dynamicData.clients.faculty.has(message.data.pop[i].username))
                        this.dynamicData.clients.faculty.delete(message.data.pop[i].username);
                }
            }
            this.update('clients');
        });

        this.socket.On('update.student', (message) => {
            if(message.data.push) {
                for(var i=0; i < message.data.push.length; i++) {
                    if(!this.dynamicData.clients.student.has(message.data.push[i].number))
                        this.dynamicData.clients.student.set(message.data.push[i].number, message.data.push[i]);
                }
            }
            if(message.data.pop) {
                for(var i=0; i < message.data.pop.length; i++) {
                    if(this.dynamicData.clients.student.has(message.data.pop[i].number))
                        this.dynamicData.clients.student.delete(message.data.pop[i].number);
                }
            }
            this.update('clients');
        });

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
            callback: async (data) => {
                var username = data.username;
                var password = data.password;
                if(username.trim() !== '' && password.trim() !== '') {
                    this.socket.Login(username, password, (response) => {
                        if(response.error !== null) {
                            this.prompt(LoginPromptOptions);
                        }
                        else {
                            this.dynamicData.self.username = username;
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