const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '..', 'src');
const BUILD_DIR = path.join(__dirname, '..', 'builddir');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

console.log('🚀 Building GNOME App...');

// Step 1: Compile TypeScript
console.log('🔨 Compiling TypeScript...');
try {
    execSync('tsc', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
}

console.log('🔄 Converting for GJS...');

// Helper function to clean JavaScript content
function cleanJSContent(content) {
    return content
        // Remove all import statements
        .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
        
        // Remove export statements
        .replace(/^export\s+{[^}]*};?\s*$/gm, '')
        .replace(/^export\s+/gm, '')
        
        // Remove 'use strict'
        .replace(/["']use strict["'];?\s*/g, '')
        
        // Remove Object.defineProperty exports
        .replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{\s*value:\s*true\s*\}\);?\s*/g, '')
        
        // Remove exports assignments
        .replace(/exports\.\w+\s*=\s*void 0;\s*/g, '')
        .replace(/exports\.\w+\s*=\s*\w+;\s*/g, '')
        
        // Clean up service references
        .replace(/settings_service_1\.SettingsService/g, 'SettingsService')
        .replace(/utils_service_1\.UtilsService/g, 'UtilsService')
        .replace(/apps_service_1\.AppsService/g, 'AppsService')
        .replace(/categories_service_1\.CategoriesService/g, 'CategoriesService')
        .replace(/updates_service_1\.UpdatesService/g, 'UpdatesService')
        
        // Remove other artifacts
        .replace(/\s*void 0;\s*\n?/g, '')
        .replace(/^\s*\n/gm, '')
        .trim();
}

// GJS header
const gjsHeader = `#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';
imports.gi.versions.GdkPixbuf = '2.0';
imports.gi.versions.cairo = '1.0';

const { Gio } = imports.gi;
const { Gtk } = imports.gi;
const { Gdk } = imports.gi;
const { Adw } = imports.gi;
const { GLib } = imports.gi;
const { Pango } = imports.gi;
const { GdkPixbuf } = imports.gi;
const cairo = imports.cairo;

`;

let combinedContent = gjsHeader;

// Process interfaces
const interfaceFiles = ['application', 'category', 'update', 'package'];
for (const interfaceName of interfaceFiles) {
    const interfaceFile = path.join(BUILD_DIR, 'interfaces', `${interfaceName}.js`);
    if (fs.existsSync(interfaceFile)) {
        console.log(`📋 Processing ${interfaceName} interface...`);
    }
}

// Add constants
const constantsDir = path.join(BUILD_DIR, 'constants');
if (fs.existsSync(constantsDir)) {
    const constantFiles = fs.readdirSync(constantsDir).filter(file => file.endsWith('.js'));
    for (const constFile of constantFiles) {
        const constPath = path.join(constantsDir, constFile);
        console.log(`📋 Adding ${constFile} constants...`);
        let content = fs.readFileSync(constPath, 'utf8');
        content = cleanJSContent(content);
        combinedContent += content + '\n';
    }
}

// Add SettingsService
const settingsServiceFile = path.join(BUILD_DIR, 'services', 'settings-service.js');
if (fs.existsSync(settingsServiceFile)) {
    console.log('📋 Adding SettingsService service...');
    let content = fs.readFileSync(settingsServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class SettingsService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add UtilsService
const utilsServiceFile = path.join(BUILD_DIR, 'services', 'utils-service.js');
if (fs.existsSync(utilsServiceFile)) {
    console.log('📋 Adding UtilsService service...');
    let content = fs.readFileSync(utilsServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class UtilsService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add AppsService
const appsServiceFile = path.join(BUILD_DIR, 'services', 'apps-service.js');
if (fs.existsSync(appsServiceFile)) {
    console.log('📋 Adding AppsService service...');
    let content = fs.readFileSync(appsServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class AppsService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add CategoriesService
const categoriesServiceFile = path.join(BUILD_DIR, 'services', 'categories-service.js');
if (fs.existsSync(categoriesServiceFile)) {
    console.log('📋 Adding CategoriesService service...');
    let content = fs.readFileSync(categoriesServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class CategoriesService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add UpdatesService
const updatesServiceFile = path.join(BUILD_DIR, 'services', 'updates-service.js');
if (fs.existsSync(updatesServiceFile)) {
    console.log('📋 Adding UpdatesService service...');
    let content = fs.readFileSync(updatesServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class UpdatesService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add CacheService
const cacheServiceFile = path.join(BUILD_DIR, 'services', 'cache-service.js');
if (fs.existsSync(cacheServiceFile)) {
    console.log('📋 Adding CacheService service...');
    let content = fs.readFileSync(cacheServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class CacheService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add PackagesService
const packagesServiceFile = path.join(BUILD_DIR, 'services', 'packages-service.js');
if (fs.existsSync(packagesServiceFile)) {
    console.log('📋 Adding PackagesService service...');
    let content = fs.readFileSync(packagesServiceFile, 'utf8');
    const classStartIndex = content.indexOf('class PackagesService {');
    if (classStartIndex !== -1) {
        content = content.substring(classStartIndex);
    }
    content = cleanJSContent(content);
    combinedContent += content + '\n';
}

// Add atomic components
const atomsDir = path.join(BUILD_DIR, 'components', 'atoms');
if (fs.existsSync(atomsDir)) {
    const atomicComponents = fs.readdirSync(atomsDir).filter(file => file.endsWith('.js'));
    for (const atomFile of atomicComponents) {
        const atomPath = path.join(atomsDir, atomFile);
        const atomName = atomFile.replace('.js', '').split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
        console.log(`📋 Adding ${atomName} atomic component...`);
        let content = fs.readFileSync(atomPath, 'utf8');
        const classStartIndex = content.indexOf(`class ${atomName} {`);
        if (classStartIndex !== -1) {
            content = content.substring(classStartIndex);
        }
        content = cleanJSContent(content);
        combinedContent += content + '\n';
    }
}

// Add components
const components = ['featured', 'categories', 'app-details', 'installed', 'updates'];
for (const component of components) {
    const componentFile = path.join(BUILD_DIR, 'components', `${component}.js`);
    if (fs.existsSync(componentFile)) {
        const componentName = component.split('-').map((word, index) => 
            index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
        console.log(`📋 Adding ${componentName}Component...`);
        let content = fs.readFileSync(componentFile, 'utf8');
        const classStartIndex = content.indexOf(`class ${componentName}Component {`);
        if (classStartIndex !== -1) {
            content = content.substring(classStartIndex);
        }
        content = cleanJSContent(content);
        combinedContent += content + '\n';
    }
}

// Add main application
const mainFile = path.join(BUILD_DIR, 'main.js');
if (fs.existsSync(mainFile)) {
    console.log('📋 Adding main application...');
    let mainContent = fs.readFileSync(mainFile, 'utf8');
    mainContent = cleanJSContent(mainContent);
    combinedContent += mainContent + '\n';
}

// Write combined file
const outputFile = path.join(BUILD_DIR, 'main.js');
fs.writeFileSync(outputFile, combinedContent);

// Make executable
try {
    fs.chmodSync(outputFile, '755');
} catch (error) {
    console.warn('⚠️  Could not make file executable:', error.message);
}

// Copy resources
console.log('📁 Copying resources...');
const dataBuildDir = path.join(BUILD_DIR, 'data');
if (!fs.existsSync(dataBuildDir)) {
    fs.mkdirSync(dataBuildDir, { recursive: true });
}

// Copy data directory
if (fs.existsSync(DATA_DIR)) {
    const copyRecursive = (src, dest) => {
        if (fs.statSync(src).isDirectory()) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            fs.readdirSync(src).forEach(file => {
                copyRecursive(path.join(src, file), path.join(dest, file));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };
    
    copyRecursive(DATA_DIR, dataBuildDir);
}

// Copy GSettings schema
const schemaFile = path.join(DATA_DIR, 'com.obision.ObisionStore.gschema.xml');
if (fs.existsSync(schemaFile)) {
    fs.copyFileSync(schemaFile, path.join(dataBuildDir, 'com.obision.ObisionStore.gschema.xml'));
}

// Compile GResource
console.log('📦 Compiling GResource...');
const gresourceXml = path.join(DATA_DIR, 'com.obision.ObisionStore.gresource.xml');
if (fs.existsSync(gresourceXml)) {
    try {
        execSync(`glib-compile-resources --sourcedir=${DATA_DIR} --target=${path.join(BUILD_DIR, 'com.obision.ObisionStore.gresource')} ${gresourceXml}`, { stdio: 'inherit' });
    } catch (error) {
        console.warn('⚠️  Could not compile GResource');
    }
}

console.log('✅ Build completed successfully!');
console.log(`📦 Application built to: ${outputFile}`);
console.log(`🚀 Run with: ./builddir/main.js`);
