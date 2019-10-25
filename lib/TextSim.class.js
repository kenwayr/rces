const use = require('@tensorflow-models/universal-sentence-encoder');
const mldist = require('ml-distance');

module.exports = class TextSim {
    async init(similarityFn = 'cosine') {
        this.model = await use.load();
        this.similarityFn = similarityFn;
    }
    setSimilarityFn(fn) {
        this.similarityFn = fn;
    }
    async compare(sets) {
            var embeddings = await this.model.embed(sets);
            var data = await embeddings.data();
            var similarities = [];
            for(var i=0; i < sets.length; i++) {
                similarities.push([]);
                for(var j=0; j < sets.length; j++) {
                    similarities[i].push(mldist.similarity[this.similarityFn](data.slice(i*512, i*512 + 512), data.slice(j*512, j*512 + 512)));
                }
            }
            embeddings.dispose();
            return similarities;
    }
    async groupSimilar({sets, threshold=0.6, similarities = null}) {
        if(!similarities)
            similarities = await this.compare(sets);
        var groups = [];
        var included = [];
        for(var i=0; i < similarities.length; i++) {
            if(!included.includes(i)) {
                included.push(i);
                var idx = groups.push([ sets[i] ]) - 1;
                for(var j=0; j < similarities[i].length; j++) {
                    if(!included.includes(j) && similarities[i][j] > threshold) {
                        included.push(j);
                        groups[idx].push(sets[j]);
                    }
                }
            }
        }
        return groups;
    }
}