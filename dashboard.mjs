#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDashboard = path.join(__dirname, 'src', 'trasgo', 'dashboard.mjs');

import(pathToFileURL(coreDashboard).href);
