import { pipeline } from '@huggingface/transformers';

let speechRecognitionPipeline = null;

self.addEventListener('message', async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'load':
            load();
            break;
        case 'generate':
            generate(data);
            break;
    }
});

async function load() {
    speechRecognitionPipeline = await pipeline('automatic-speech-recognition', 'onnx-community/moonshine-tiny-ONNX');
    self.postMessage({ status: 'ready' });
}

async function generate({ audio }) {
    if (!speechRecognitionPipeline) {
        return;
    }
    const output = await speechRecognitionPipeline(audio);
    self.postMessage({ status: 'complete', output });
}
