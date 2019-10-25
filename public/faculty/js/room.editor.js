class RoomEditor {
    constructor(target, {activeSeatSrc, inactiveSeatSrc, cellWidth = 25, cellHeight = 25, cellPadding = 5, panSensitivity = 1}) {
        this.canvas = target;
        this.context = target.getContext('2d');
        this.boundaries = target.getBoundingClientRect();
        this.seats = {
            active: {
                image: new Image(),
                loaded: false
            },
            inactive: {
                image: new Image(),
                loaded: false
            }
        };
        this.seats.active.image.src = activeSeatSrc;
        this.seats.inactive.image.src = inactiveSeatSrc;
        this.config = {
            cellWidth: cellWidth,
            cellHeight: cellHeight,
            cellPadding: cellPadding,
            contextWidth: target.width,
            contextHeight: target.height,
            contextTransform: {
                x: 0,
                y: 0
            },
            savedContextTransform: {
                x: 0,
                y: 0
            },
            panSensitivity: panSensitivity
        };
        this.matrix = [];
        this.drawingMode = false;
        this.pivot = {x:0,y:0};
    }
    Init() {
        return new Promise((resolve, reject) => {
            this.canvas.addEventListener('mousedown', (e) => {
                var clientX = e.clientX - this.boundaries.left;
                var clientY = e.clientY - this.boundaries.top;
                this.lastCell = {r: -1, c: -1};
                this.pivot = {x: clientX, y: clientY};
                this.drawingMode = true;
                this.mouseEvaluator(e);
            });
            this.canvas.addEventListener('mouseup', (e) => {
                this.drawingMode = false;
                this.config.savedContextTransform.x = this.config.contextTransform.x;
                this.config.savedContextTransform.y = this.config.contextTransform.y;
            });
            this.canvas.addEventListener('mouseleave', (e) => {
                this.drawingMode = false;
                this.config.savedContextTransform.x = this.config.contextTransform.x;
                this.config.savedContextTransform.y = this.config.contextTransform.y;
            });
            this.mouseEvaluator = (e) => {
                var clientX = e.clientX - this.boundaries.left;
                var clientY = e.clientY - this.boundaries.top;
                if(this.drawingMode) {
                    if(e.which === 3) {
                        var tx = clientX - this.pivot.x;
                        var ty = clientY - this.pivot.y;
                        this.config.contextTransform.x = this.config.savedContextTransform.x + tx * this.config.panSensitivity;
                        this.config.contextTransform.y = this.config.savedContextTransform.y + ty * this.config.panSensitivity;
                    }
                    else {
                        var x = (clientX - this.config.savedContextTransform.x) / (this.config.cellWidth + this.config.cellPadding);
                        var y = (clientY - this.config.savedContextTransform.y) / (this.config.cellHeight + this.config.cellPadding);
                        if(x < this.config.contextWidth && y < this.config.contextHeight) {
                            var r = Math.floor(y);
                            var c = Math.floor(x);
                            var rd = (y - r) * (this.config.cellHeight + this.config.cellPadding);
                            var cd = (x - c) * (this.config.cellWidth + this.config.cellPadding);
                            if(r < this.matrix.length && this.matrix[0] && c < this.matrix[0].length && rd > this.config.cellPadding && cd > this.config.cellPadding && (r !== this.lastCell.r || c !== this.lastCell.c)) {
                                this.matrix[r][c] = !this.matrix[r][c];
                                this.lastCell = {r: r, c: c};
                            }
                        }
                    }
                    this.DrawMatrix();
                }
            };
            this.canvas.addEventListener('mousemove', this.mouseEvaluator);
            this.canvas.addEventListener('click', (e) => {
                this.drawingMode = true;
                this.mouseEvaluator(e);
                this.drawingMode = false;
            });
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            this.seats.active.image.onload = (e) => {
                this.seats.active.loaded = true;
                if(this.seats.inactive.loaded)
                    resolve();
            };
            this.seats.inactive.image.onload = (e) => {
                this.seats.inactive.loaded = true;
                if(this.seats.active.loaded)
                    resolve();
            };
        });
    }
    DrawSeat(x, y, active) {
        if(active && this.seats.active.loaded)
            this.context.drawImage(this.seats.active.image, x, y, this.config.cellWidth, this.config.cellHeight);
        else if(!active && this.seats.inactive.loaded)
            this.context.drawImage(this.seats.inactive.image, x, y, this.config.cellWidth, this.config.cellHeight);
        else
            console.log("Image not yet loaded");
    }
    ClearScreen() {
        this.context.clearRect(0,0, this.config.contextWidth, this.config.contextHeight);
    }
    CreateGrid(rows, cols) {
        this.matrix = [];
        for(var r=0; r < rows; r++) {
            this.matrix.push([]);
            for(var c=0; c < cols; c++) {
                this.matrix[r].push(0);
            }
        }
        this.DrawMatrix();
    }
    DrawMatrix() {
        this.ClearScreen();
        for(var i=0; i < this.matrix.length; i++) {
            for(var j=0; j < this.matrix[i].length; j++) {
                this.DrawSeat( (this.config.cellPadding + this.config.cellWidth) * j + this.config.cellPadding + this.config.contextTransform.x, (this.config.cellPadding + this.config.cellHeight) * i + this.config.cellPadding + this.config.contextTransform.y, this.matrix[i][j]);
            }
        }
    }
}

class RoomView {
    constructor(target, {occupiedSrc, emptySrc, cellWidth=25, cellHeight=25, cellPadding=5}) {
        this.canvas = target;
        this.context = target.getContext("2d");
        this.boundaries = target.getBoundingClientRect();
        this.matrix = [];
        this.seats = {
            occupied: {
                image: new Image(),
                loaded: false
            },
            empty: {
                image: new Image(),
                loaded: false
            }
        };
        this.seats.occupied.image.src = occupiedSrc;
        this.seats.empty.image.src = emptySrc;
        this.config = {
            cellWidth: cellWidth,
            cellHeight: cellHeight,
            cellPadding: cellPadding,
            contextWidth: target.width,
            contextHeight: target.height
        };
    }
    Init() {
        return new Promise((resolve, reject) => {
            this.canvas.addEventListener('mousedown', (e) => {
                var clientX = e.clientX - this.boundaries.left;
                var clientY = e.clientY - this.boundaries.top;
                // find seat at position and trigger details
                var x = clientX / (this.config.cellWidth + this.config.cellPadding);
                var y = clientY / (this.config.cellHeight + this.config.cellPadding);
                var r = Math.floor(y);
                var c = Math.floor(x);
            });

            this.seats.occupied.image.onload = (e) => {
                this.seats.occupied.loaded = true;
                if(this.seats.empty.loaded)
                    resolve();
            };
            this.seats.empty.image.onload = (e) => {
                this.seats.empty.loaded = true;
                if(this.seats.occupied.loaded)
                    resolve();
            };
        });
    }
    ImportSeatMatrix(matrix) {
        this.matrix = matrix.map((v) => v.map((v1) => v1 ? 1 : 0));
        this.canvas.width = this.matrix[0].length * (this.config.cellWidth + this.config.cellPadding);
        this.canvas.height = this.matrix.length * (this.config.cellHeight + this.config.cellPadding);
        this.config.contextWidth = this.canvas.width;
        this.config.contextHeight = this.canvas.height;
        console.log(this.matrix);
        this.DrawMatrix();
    }
    SetMatrix(matrix) {
        this.matrix = matrix;
        this.canvas.width = this.matrix[0].length * (this.config.cellWidth + this.config.cellPadding);
        this.canvas.height = this.matrix.length * (this.config.cellHeight + this.config.cellPadding);
        this.config.contextWidth = this.canvas.width;
        this.config.contextHeight = this.canvas.height;
        this.DrawMatrix();
    }
    SetStatus(r,c,v) {
        this.matrix[r][c] = v;
        this.DrawMatrix();
    }
    ClearScreen() {
        this.context.clearRect(0,0, this.config.contextWidth, this.config.contextHeight);
    }
    DrawSeat(x, y, status) {
        if(status === 0)
            return;
        if(status === 2 && this.seats.occupied.loaded)
            this.context.drawImage(this.seats.occupied.image, x, y, this.config.cellWidth, this.config.cellHeight);
        else if(status === 1 && this.seats.empty.loaded)
            this.context.drawImage(this.seats.empty.image, x, y, this.config.cellWidth, this.config.cellHeight);
        else if(status > 2 && this.seats.occupied.loaded) {
            if(status === 3)
                this.context.fillStyle = '#217dbb';
            else if(status === 4)
                this.context.fillStyle = '#1ABB9C';
            else if(status === 5)
                this.context.fillStyle = '#ff2f0f';
            this.context.beginPath();
            this.context.arc(x + this.config.cellWidth/2, y + this.config.cellHeight/2, this.config.cellWidth/2, 0, 2 * Math.PI);
            this.context.fill();
            this.context.drawImage(this.seats.occupied.image, x, y, this.config.cellWidth, this.config.cellHeight);
        }
        else
            console.log("Image not yet loaded");
    }
    DrawMatrix() {
        this.ClearScreen();
        for(var i=0; i < this.matrix.length; i++) {
            for(var j=0; j < this.matrix[i].length; j++) {
                if(this.matrix[i][j] > 0)
                    this.DrawSeat( (this.config.cellPadding + this.config.cellWidth) * j + this.config.cellPadding, (this.config.cellPadding + this.config.cellHeight) * (this.matrix.length - i - 1) + this.config.cellPadding, this.matrix[i][j]);
            }
        }
    }
}