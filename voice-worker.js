import { pipeline } from '@huggingface/transformers';

let speechRecognitionPipeline = null;
let vqaPipeline = null;

self.addEventListener('message', async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'load':
            load();
            break;
        case 'generate':
            generate(data);
            break;
        case 'vqa':
            vqa(data);
            break;
    }
});

async function load() {
    speechRecognitionPipeline = await pipeline('automatic-speech-recognition', 'onnx-community/moonshine-tiny-ONNX');
    vqaPipeline = await pipeline('visual-question-answering', 'dandelin/vilt-b32-finetuned-vqa');
    self.postMessage({ status: 'ready' });
}

async function generate({ audio }) {
    if (!speechRecognitionPipeline) {
        return;
    }
    const output = await speechRecognitionPipeline(audio);
    self.postMessage({ status: 'complete', output });
}

async function vqa({ image, question }) {
    if (!vqaPipeline) {
        return;
    }
    const output = await vqaPipeline(image, question);
    self.postMessage({ status: 'vqa-complete', output });
}
