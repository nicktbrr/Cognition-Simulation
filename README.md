<div align="center">
  <h1 align="center">Cognition Simulation</h1>
  <p align="center">
    A modern full-stack application for building advanced Cognition Simulation systems, enabling seamless integration of metrics and evaluation workflows. This setup provides an intuitive platform for crafting simulations that assess cognitive processes, with features like customizable metrics tracking, real-time evaluation, and insightful feedback. Built with Next.js and Flask, it empowers developers and researchers to create robust simulations with precision and efficiency, all while maintaining high performance and adaptability to diverse cognitive modeling needs.
    <br />
    <a href="#getting-started"><strong>Getting Started »</strong></a>
    &nbsp;&nbsp;&nbsp;
    <a href="#about-the-project"><strong>About The Project »</strong></a>
    &nbsp;&nbsp;&nbsp;
    <a href="#contributing"><strong>Contributing »</strong></a>
    <br />
  </p>
</div>

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [About The Project](#about-the-project)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
  - [Frontend Development](#frontend-development)
  - [Backend Development](#backend-development)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## About The Project

This project is a full-stack application built with modern technologies:

- **Frontend**: Next.js 14 with TypeScript, featuring:
  - Modern UI components with Radix UI
  - Tailwind CSS for styling
  - Interactive flow diagrams with React Flow
  - Form handling with React Hook Form and Zod validation

- **Backend**: Flask-based API with:
  - Machine learning capabilities (PyTorch, scikit-learn)
  - Natural language processing (transformers, OpenAI)
  - Data processing with pandas and numpy
  - Supabase integration for data storage

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **pip** (Python package manager)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/cognition-simulation.git
   cd cognition-simulation
   ```

2. Set up the frontend:
   ```bash
   cd frontend
   npm install
   ```

3. Set up the backend:
   ```bash
   cd ../backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Create environment files:

   Frontend (.env.local):
   ```plaintext
   NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase API key
   NEXT_PUBLIC_GCP_TOKEN: Authentication token for production
   NEXT_PUBLIC_DEV: Set to 'development' for local development
   NEXT_PUBLIC_OAUTH_CLIENT_ID: Key used for GCP OAuth
   ```

   Backend (.env):
   ```plaintext
   VITE_SUPABASE_URL: Supabase project URL
   VITE_SUPABASE_KEY: Supabase API key
   VITE_SUPABASE_BUCKET_URL Supabase Bucket URL
   GEMINI_KEY: Google Gemini API key
   VITE_GCP_TOKEN: Authentication token for production
   DEV: Set to 'development' for local development
   OPENAI_API_KEY OpenAI API key
   ```

---

## Features

- **Modern Frontend Stack**:
  - Next.js 14 with App Router
  - TypeScript for type safety
  - Tailwind CSS for styling
  - Radix UI components
  - Interactive data visualization
  - Drag-and-drop interfaces

- **Powerful Backend**:
  - Flask REST API
  - Machine learning integration
  - Natural language processing
  - Data analysis capabilities
  - Supabase database integration

- **Development Tools**:
  - Hot Module Replacement
  - TypeScript support
  - ESLint and Prettier
  - Docker support

---

## Usage

### Frontend Development

Start the Next.js development server:
```bash
cd frontend
npm run dev
```

### Backend Development

Start the Flask development server:
```bash
cd backend
python app.py
```

---

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. If you'd like to contribute:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to your branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See the `LICENSE` file for more information.

---

## Acknowledgments

- [Next.js](https://nextjs.org/) for the React framework
- [Flask](https://flask.palletsprojects.com/) for the Python backend
- [Supabase](https://supabase.io/) for the database solution
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Radix UI](https://www.radix-ui.com/) for accessible components

---

<p align="right">(<a href="#cognition-simulation">back to top</a>)</p>



