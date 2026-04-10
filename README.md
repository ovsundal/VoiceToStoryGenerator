# VoiceToStoryGenerator

A Windows desktop app that converts voice or text into illustrated visual stories, designed to support communication with autistic individuals.

## Setup

### 1. Install Node dependencies

```
npm install
```

### 2. Set up the Python environment

```
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.sample` to `.env` and fill in your values:

```
cp .env.sample .env
```

| Variable | Required | Description |
|---|---|---|
| `HF_TOKEN` | Yes, for FLUX | Hugging Face access token for downloading gated models |

**Getting a Hugging Face token:**
1. Create a free account at [huggingface.co](https://huggingface.co)
2. Accept the model terms at [black-forest-labs/FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell)
3. Create a token with Read access at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. Paste the token into your `.env` file

> `.env` is gitignored and will never be committed.

### 4. Run the app

```
npm run dev
```

AI models (Whisper, Llama 3.2, FLUX.1-schnell) are downloaded automatically on first use and cached in `resources/models/`.
