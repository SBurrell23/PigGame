# Vue 3 + Vite + Tailwind CSS Project

A clean, minimal Vue 3 application built with Vite and styled with Tailwind CSS. This project is optimized for rapid development with no testing dependencies.

## 🚀 Quick Start

### Prerequisites
- Node.js (version 20.19.0 or higher)
- npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## 📦 Available Scripts

- `npm run dev` - Start the development server with hot reload
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally

## 🛠️ Technology Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **Vite** - Next generation frontend tooling for fast development
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **JavaScript** - No TypeScript complexity, pure JavaScript for simplicity

## 📁 Project Structure

```
src/
├── assets/          # Static assets and CSS
├── components/      # Vue components
├── App.vue         # Root component
└── main.js         # Application entry point
```

## 🎨 Styling with Tailwind CSS

This project uses Tailwind CSS v4 for styling:

- **Utility Classes**: Use Tailwind's utility classes directly in your templates
- **Responsive Design**: Built-in responsive design system
- **Custom Configuration**: Modify `tailwind.config.js` for custom styling
- **PostCSS Integration**: Seamless integration with Vite's build process

### Example Usage:
```vue
<template>
  <div class="bg-blue-500 text-white p-4 rounded-lg shadow-md">
    <h1 class="text-2xl font-bold mb-2">Hello World</h1>
    <p class="text-blue-100">Beautiful Tailwind styling!</p>
  </div>
</template>
```

## 🎯 Development Features

- ⚡ **Lightning Fast HMR** - Instant updates during development
- 🔥 **Hot Reload** - Components update without losing state
- 📱 **Mobile First** - Responsive design out of the box
- 🎨 **Utility-First CSS** - Rapid UI development with Tailwind
- 🧩 **Component Architecture** - Modular and reusable components
- 🚀 **Optimized Builds** - Production-ready builds with Vite

## 📝 Next Steps

1. **Add Components**: Create new Vue components in `src/components/`
2. **Build UI**: Use Tailwind CSS utilities for rapid styling
3. **Add Features**: Implement your application logic
4. **Customize Design**: Modify `tailwind.config.js` for custom styling
5. **Deploy**: Build and deploy your application

## 🔧 Configuration Files

- `vite.config.js` - Vite configuration
- `tailwind.config.js` - Tailwind CSS configuration  
- `postcss.config.js` - PostCSS configuration for Tailwind processing

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension for Vue 3 support.

---

**Ready to build something amazing!** 🎉

This is a clean, test-free setup perfect for rapid prototyping and development.
