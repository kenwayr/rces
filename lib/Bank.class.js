const uniqid = require('uniqid');
const TextSim =  require('./TextSim.class');
const Map = require('collections/map');

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

module.exports = class Bank {
    constructor() {
        this.bank = new Map();
        this.sets = new Map();
        this.clients = new Map();
        this.textsim = new TextSim();
    }
    async Init() {
        await this.textsim.init();
    }
    AddCandidate(candidateId) {
        this.clients.set(candidateId, { id: candidateId, contributions: 0, score: 0, answers: [] });
    }
    RemoveCandidate(candidateId) {
        this.clients.delete(candidateId);
    }
    AddQuestion({text=null, options=[], correct=[], author}) {
        var id = uniqid();
        this.bank.set(id, { id: id, text: text, options: options, correct: correct, ratings: [], author: author });
        (this.clients.get(author).contributions)++;
    }
    GetQuestions() {
        return Array.from(this.bank.values());
    }
    GetQuestion(id) {
        return this.bank.get(id);
    }
    RateQuestion(id, client, score) {
        if(this.bank.has(id)) {
            var record = this.bank.get(id);
            if(record.ratings.findIndex((v) => v.author === client) === -1) {
                record.ratings.push({ author: client, score: score });
                this.bank.set(id, record);
            }
        }
    }
    RemoveQuestion(id) {
        this.bank.delete(id);
    }
    SubmitAnswer(client, answer) {
        var question = this.sets.get(client).get(answer.id);
        this.clients.get(client).answers.push({ id: question.id, text: question.text, options: question.options, correct: question.correct, author: question.author, selected: answer.selected, score: question.score, status: (question.correct === answer.selected) });
    }
    async GenerateSets() {
        var report = {
            success: false,
            errors: [],
            genTime: 0,
            inputSize: 0,
            outputSize: 0
        };

        var start = Date.now();
        var questions = [...this.bank.values()];
        report.inputSize = questions.length;

        var similarities = await this.textsim.compare(questions.map((v) => v.text));
        var groups = await this.textsim.groupSimilar({
            sets: questions,
            threshold: 0.6,
            similarities: similarities
        });
        report.outputSize = groups.length;

        this.clients.forEach((client, id) => {
            var set = new Map();
            var authorIndices = [];
            var question = null;
            for(var i=0; i < groups.length; i++) {
                for(var j=0; j < groups[i].length; j++) {
                    if(groups[i][j].author === id)
                        authorIndices.push(j);
                }
                if(authorIndices.length === 0) {
                    question = groups[i][getRandomInt(0, groups[i].length)];
                    question.score = 10; // best match
                }
                else {
                    var index = 0;
                    while(authorIndices.includes(index) && index < groups[i].length - 1)
                        index++;
                    question = groups[i][getRandomInt(0, index)];
                    if(index === groups[i].length - 1)
                        question.score = 1; // worst match
                    else
                        question.score = 2; // acceptable match
                }
                set.set(question.id, question);
            }
            this.sets.set(id, set);
        });

        var end = Date.now();

        report.genTime = (end - start) + ' ms';

        report.success = true;

        return report;
    }
    GetSets() {
        console.log(this.sets.toJSON());
        return this.sets;
    }
    GetData() {
        this.clients.forEach((client, id) => {
            client.score = (client.contributions * 5) + client.answers.reduce( (a, v) => a + (v.status ? v.score : -(v.score/2)), 0);
        });
        return this.clients;
    }
}