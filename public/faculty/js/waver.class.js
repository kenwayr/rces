var AudioContext = window.AudioContext || window.webkitAudioContext;

class Waver {
    constructor (canvas, stream) {
        this.READY = 2;
        this.PLAYING = 1;
        this.PAUSED = 0;
        this.STOPPED = -1;
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.regions = [];
        this.stream = stream;
        this.audioContext = new AudioContext();
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioSource = this.audioContext.createMediaStreamSource(this.stream);
        this.audioAnalyser.smoothingTimeConstant = 0.5;
        this.audioSource.connect(this.audioAnalyser);
        this.buffer = [];
        this.maxBufferSize = canvas.width;
        this.state = this.READY;
        this.GlobalX = 0;
        this.LastFrameTimestamp = Date.now();
        this.FPS = 25;
        this.FrameInterval = 1000 / this.FPS;
        this.render();
    }

    _UpdateBuffer() {
        var tempTimeBuffer = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(tempTimeBuffer);
        var computed = tempTimeBuffer.reduce((a,v) => a > v ? a : v); // Max Display
        if(this.buffer.length > this.maxBufferSize)
            this.buffer.shift();
        this.buffer.push(computed);
        this.GlobalX += 1;
    }

    _Draw() {
        this.context.clearRect(0,0,this.canvas.width,this.canvas.height);
        var currentCoords = {x: 0, y: this.canvas.height};
        this.context.beginPath();
        this.context.moveTo(currentCoords.x, currentCoords.y);
        for(var i=0; i < this.buffer.length; i++) {
            currentCoords.x += 1;
            currentCoords.y = this.canvas.height - this.buffer[i];
            this.context.lineTo(currentCoords.x, currentCoords.y);
            this.context.moveTo(currentCoords.x, currentCoords.y);
        }
        for(var i=0; i < this.regions.length; i++) {
            if(this.GlobalX > this.canvas.width)
                this.regions[i].x -= 1;
            if(this.regions[i].x < -20)
                this.regions.splice(i, 1);
            else {
                this.context.fillStyle = this.regions[i].fillStyle;
                this.context.fillRect(this.regions[i].x, 0, 20, this.canvas.height);
            }
        }
        this.context.lineTo(currentCoords.x + 1, this.canvas.height);
        this.context.moveTo(currentCoords.x + 1, this.canvas.height);
        this.context.lineTo(this.canvas.width, this.canvas.height);
        this.context.stroke();
    }

    pause() {
        this.state = this.PAUSED;
    }

    play() {
        this.state = this.PLAYING;
    }

    stop() {
        if(this.state !== this.READY && this.state !== this.STOPPED) {
            this.state = this.STOPPED;
            cancelAnimationFrame(this.animFrame);
        }
    }

    addRegion(region) {
        region.x = Math.min(this.GlobalX, this.canvas.width);
        this.regions.push(region);
    }

    render() {
        this.animFrame = requestAnimationFrame(this.render.bind(this));
        this.CurrentFrameTimestamp = Date.now();
        this.TimeDifference = this.CurrentFrameTimestamp - this.LastFrameTimestamp;
        if(this.TimeDifference > this.FrameInterval) {
            if(this.state === this.PLAYING) {
                this._UpdateBuffer();
                this._Draw();
            }
            this.LastFrameTimestamp = this.CurrentFrameTimestamp - (this.TimeDifference % this.FrameInterval);
        }
    }
}