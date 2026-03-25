#!/usr/bin/env node

/**
 * Script para generar maps.config.ts en tiempo de build
 * Lee la API key desde variables de entorno en Vercel
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'TU_API_KEY_AQUI';

const configContent = `/**
 * Configuración de Google Maps
 * GENERADO AUTOMÁTICAMENTE - NO EDITAR
 */

export const GOOGLE_MAPS_CONFIG = {
  apiKey: '${apiKey}',
  libraries: ['places'],
  language: 'es'
};
`;

const configPath = path.join(__dirname, '../src/app/config/maps.config.ts');

// Crear directorio si no existe
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Escribir archivo
fs.writeFileSync(configPath, configContent, 'utf8');

console.log('✅ maps.config.ts generado correctamente');
console.log('   API Key: configurada');
