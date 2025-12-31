# ✨ Eduly Panel - AI Exam Tutor

![Icon](icons/1.png)

**Eduly Panel** is a powerful Chrome Extension designed to help students—especially those who prefer self-study—understand complex lecture slides and web content instantly. 

Acting as an **Expert University Lecturer**, it breaks down difficult topics into simple, exam-focused notes with a single click.

## 🚀 Key Features

- **Simplify Selection**: Highlight any text on a webpage or PDF and get a simplified, beginner-friendly explanation.
- **Exam-Oriented Notes**: The AI focuses on key points, removing jargon and providing real-life examples.
- **PDF Support**: Works seamlessly on local PDF files (lecture slides) with a robust fallback for text selection.
- **Premium Dark Mode**: A beautiful, modern UI designed for late-night study sessions.
- **Free & Private**: Powered by the free tier of ApiFreeLLM. No API key required.

## 🛠️ Installation

Since this extension is in developer preview, you can install it manually:

1.  **Clone or Download** this repository.
2.  Open Chrome and go to `chrome://extensions`.
3.  Enable **Developer mode** (toggle in the top right).
4.  Click **Load unpacked**.
5.  Select the folder where you saved this project.
6.  **Important for PDFs**: Find "Eduly Panel" in the list, click **Details**, and enable **"Allow access to file URLs"**.

## 📖 How to Use

1.  **Pin the Extension**: Click the puzzle piece icon in Chrome and pin **Eduly Panel** to your toolbar.
2.  **Open the Panel**: Click the Eduly icon. You will see a Welcome Screen on first launch.
3.  **Select (or Copy) Text**:
    *   **Standard Method**: Simply highlight text on any webpage.
    *   **PDF / Difficult Sites**: Highlight the text and press **Ctrl+C** (Manual Copy).
4.  **Click "Summarize Selection"**: The AI will detect your selection (or clipboard) and generate clear, exam-focused notes.

## 💻 Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Properties, Flexbox/Grid), Vanilla JavaScript.
- **Extension API**: Chrome Side Panel API, Scripting API.
- **AI Backend**: ApiFreeLLM (Free Tier).

## 📄 License

This project is open-source and available for educational purposes.
