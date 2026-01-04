# Recipe App

A recipe web app designed to make cooking easier with LLM-powered import, smart quantity scaling, and integrated cooking timers.

## Features

- **Smart Import**: Add recipes from photos, URLs, or pasted text - the LLM extracts and structures everything.
- **Automatic Normalisation**: Automatically converts units to metric, adapts to fan oven temperatures, and standardizes ingredient names.
- **Multi-Portion Variants**: When recipes provide quantities for multiple serving sizes, all variants are stored with exact quantities. Switch between portions with a simple number picker - no scaling artifacts.
- **Cooking Timers**: Start timers directly from recipe steps with audio alerts.
- **Recipe Chat**: Ask questions about a recipe or request modifications (make it vegetarian, substitute ingredients, etc.). Can also request new portion sizes.
- **Cooking List**: Save recipes you're planning to make.
- **Screen Wake Lock**: Keep your screen on while cooking.

## Getting Started

### Quick Start (Docker)

1.  Create your configuration files:
    ```bash
    cp config.example.yml config.yml
    cp secrets.example.yml secrets.yml
    ```
2.  Edit `secrets.yml` to add your Google API key.
3.  Run the application:
    ```bash
    docker-compose up --build
    ```
    The app will be available at http://localhost:3000.

For development setup instructions and prerequisites, please see [overview.md](overview.md).

## Documentation

For a comprehensive technical breakdown, including the technology stack, project structure, and API reference, please refer to [overview.md](overview.md).
