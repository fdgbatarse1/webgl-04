# WebGL Homework 04 - Interactive 3D Scene with Slider Control

## 📹 Demo Video

[![Watch the video](/public/images/snitch.png)](https://www.loom.com/share/cff128ac81f94ea7bc197c2d438eb963?sid=4346f3dc-7d47-425d-97d8-40136ab8eb4c)

## 📋 Summary

This project implements a Three.js scene controlled by a smooth scroll-based slider system for the WebGL homework assignment:

- **Smooth Slider Control** - Scroll/touch interactions drive scene animations with lerp-based smoothing
- **Multi-dimensional Animation** - Slider controls position, scale, floating motion, and camera orbiting simultaneously
- **Advanced Easing** - Uses MathUtils.smoothstep and custom timing for refined motion curves
- **3D Model Loading** - Animated Golden Snitch model with dynamic scaling and positioning
- **HDR Environment Lighting** - Realistic PBR materials with environment mapping
- **Post-Processing Pipeline** - Bloom and FXAA effects with proper render passes
- **Performance Monitoring** - Stats.js integration with optimized render loop

## 🚀 How to Run

### Prerequisites

- Node.js (version 16 or higher)
- npm package manager

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/fdgbatarse1/webgl-04.git
   cd webgl-04
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:5173` (or the URL shown in your terminal)
   - You should see an animated Golden Snitch model with realistic HDR lighting and post-processing effects
   - Scroll with mouse wheel or drag on mobile to control the slider and watch the scene transform smoothly

## 🔗 Links

- **Repository**: https://github.com/fdgbatarse1/webgl-04
- **Live Demo**: https://webgl-04.vercel.app/

## 🅭 Credits

"Golden Snitch #SGP29" (https://skfb.ly/KnuR) by JuanG3D is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
