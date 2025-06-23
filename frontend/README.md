# Cognition Simulation Frontend

A Next.js-based frontend application for building and evaluating cognitive processes, deployed on Vercel.

## Overview

This application provides a user interface for creating cognitive workflows, defining evaluation criteria, and visualizing simulation results. It interacts with the backend service to run simulations and fetches data from Supabase.

## Features

- Visual cognitive process builder with a drag-and-drop interface
- Dynamic step and criteria management
- CSV upload for process creation
- Simulation status indicators
- User authentication with Google
- Responsive design for various screen sizes

## Key Components

- `CognitiveProcess`: Allows users to define the steps of a cognitive process.
- `EvaluationCriteria`: Enables the selection and creation of evaluation metrics.
- `ActionButtons`: Provides controls for submitting, downloading, and resetting simulations.
- `CognitiveFlow`: A React Flow-based component for visualizing the cognitive process.

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous API key
- `NEXT_PUBLIC_GCP_TOKEN`: Authentication token for backend requests in production.
- `NEXT_PUBLIC_DEV`: Set to 'development' for local development.

## Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The application is deployed on Vercel. The deployment is automatically triggered by pushes to the main branch of the GitHub repository.

## Dependencies

Key dependencies include:
- Next.js 14.2.5
- React 18
- Tailwind CSS 3.4.1
- Supabase.js
- React Flow
- PapaParse for CSV parsing
