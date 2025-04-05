# Wedding E-Invitation Platform

An interactive wedding e-invitation platform designed to create memorable digital experiences for wedding guests. The application offers dynamic features to engage and connect wedding attendees through innovative digital interactions.

## Features

- **Interactive UI**: Beautiful, responsive design with animations and interactive elements
- **RSVP System**: Simple form for guests to confirm attendance and provide details
- **Wedding Details**: Displays venue information, event schedule, and couple details
- **Message Board**: Allows guests to leave well-wishes and messages
- **Background Music**: Wedding piano melody that can be toggled on/off
- **Photo Gallery**: Showcases couple photos with beautiful animations
- **Countdown Timer**: Dynamic countdown to the wedding day

## Technologies Used

### Frontend
- React.js
- TypeScript
- Tailwind CSS
- Framer Motion (animations)
- React Query (data fetching)
- ShadCN UI (component library)
- Wouter (routing)

### Backend
- Python Flask (main backend)
- Express.js (serving static files)
- In-memory database (for development)

## Project Structure

```
├── assets/                 # Static assets like SVGs and images
├── client/                 # Frontend React application
│   ├── public/             # Public assets including music files
│   └── src/                # React source code
│       ├── components/     # UI components
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility functions
│       └── pages/          # Page components
├── public/                 # Static files
├── server/                 # Express server for development
├── shared/                 # Shared TypeScript types
└── app.py                  # Flask backend application
```

## Getting Started

### Prerequisites

- Node.js v16+
- Python 3.10+
- Poetry (for Python dependency management)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/wedding-e-invitation.git
cd wedding-e-invitation
```

2. Install frontend dependencies:

```bash
npm install
```

3. Install backend dependencies using Poetry:

```bash
poetry install
```

### Running the Application

Start the development server:

```bash
npm run dev
```

This will start both the Express server for static files and the Flask backend API.

## Development Guidelines

### Code Organization

The project follows SOLID principles:

- **Single Responsibility**: Each component and module has a single responsibility
- **Open/Closed**: Components are open for extension but closed for modification
- **Liskov Substitution**: All components properly implement their interfaces
- **Interface Segregation**: Small, focused interfaces are used throughout
- **Dependency Inversion**: Higher-level modules depend on abstractions

### Adding New Features

1. For frontend features:
   - Create components in `client/src/components/`
   - Add pages in `client/src/pages/`
   - Define styles using Tailwind classes

2. For backend features:
   - Add routes in `app.py` or create new modules as needed
   - Follow the existing pattern for consistent API responses

### Coding Standards

- Use TypeScript for type safety in the frontend
- Follow PEP 8 guidelines for Python code
- Use meaningful variable and function names
- Add comments for complex logic
- Write unit tests for critical functionality

## API Endpoints

- `POST /api/rsvp` - Submit an RSVP
- `GET /api/rsvp` - Get all RSVPs
- `GET /api/rsvp/:email` - Get RSVP by email
- `POST /api/messages` - Submit a message
- `GET /api/messages` - Get all messages

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to [names of collaborators] for their contributions
- Wedding piano music from [source]