HeadTTS 1.3.0 — https://github.com/met4citizen/HeadTTS

Browser modules and the English pronunciation dictionary are copied from the
published @met4citizen/headtts@1.3.0 npm package. See LICENSE for the MIT terms.
The dictionary's CMU/Misaki notices are retained in dictionaries/en-us.txt.
Model weights, voice embeddings and Transformers.js are downloaded on first use;
they are not bundled into Pixel Book. The timestamped Kokoro model and
Transformers.js use Apache 2.0 licenses. See the upstream README for provenance:
https://github.com/met4citizen/HeadTTS#readme

Pixel Book uses local WebGPU/WASM endpoints only. No book text is sent to a TTS
server. The model is loaded only after pressing Read aloud.
