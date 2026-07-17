import fs from 'fs';
import path from 'path';

const iconMap = {
  'fa-times': 'FiX',
  'fa-download': 'FiDownload',
  'fa-folder-open': 'FiFolder',
  'fa-times-circle': 'FiXCircle',
  'fa-exclamation-triangle': 'FiAlertTriangle',
  'fa-spinner': 'FiLoader',
  'fa-ban': 'FiSlash',
  'fa-file-invoice-dollar': 'FiFileText',
  'fa-edit': 'FiEdit',
  'fa-link': 'FiLink',
  'fa-hand-holding-usd': 'FiDollarSign',
  'fa-shopping-bag': 'FiShoppingBag',
  'fa-clock': 'FiClock',
  'fa-search': 'FiSearch',
  'fa-shield-alt': 'FiShield',
  'fa-info-circle': 'FiInfo',
  'fa-lock': 'FiLock',
  'fa-project-diagram': 'FiBriefcase',
  'fa-chevron-down': 'FiChevronDown',
  'fa-exclamation-circle': 'FiAlertCircle',
  'fa-file-excel': 'FiFile',
  'fa-file-pdf': 'FiFileText',
  'fa-flask': 'FiActivity',
  'fa-calculator': 'FiMonitor',
  'fa-coins': 'FiDatabase',
  'fa-arrow-left': 'FiArrowLeft',
  'fa-arrow-trend-up': 'FiTrendingUp',
  'fa-arrow-trend-down': 'FiTrendingDown',
  'fa-scale-balanced': 'FiBriefcase',
  'fa-piggy-bank': 'FiDollarSign',
  'fa-magic': 'FiStar',
  'fa-check': 'FiCheck',
  'fa-check-double': 'FiCheckCircle',
  'fa-arrow-right': 'FiArrowRight',
  'fa-users-gear': 'FiUsers',
  'fa-suitcase-rolling': 'FiBriefcase',
  'fa-list-check': 'FiList',
  'fa-sliders': 'FiSliders',
  'fa-plus-circle': 'FiPlusCircle',
  'fa-list-numeric': 'FiList',
  'fa-trash': 'FiTrash2',
  'fa-trash-alt': 'FiTrash2',
  'fa-list-ul': 'FiList',
  'fa-cloud-download-alt': 'FiDownloadCloud',
  'fa-keyboard': 'FiMonitor',
  'fa-bolt': 'FiZap',
  'fa-wand-magic-sparkles': 'FiStar',
  'fa-external-link-alt': 'FiExternalLink',
  'fa-file-alt': 'FiFileText',
  'fa-plus': 'FiPlus',
  'fa-sign-out-alt': 'FiLogOut',
  'fa-sign-in-alt': 'FiLogIn',
  'fa-undo': 'FiRotateCcw',
  'fa-save': 'FiSave',
  'fa-chart-line': 'FiTrendingUp',
  'fa-boxes': 'FiBox',
  'fa-sync-alt': 'FiRefreshCw',
  'fa-arrow-down': 'FiArrowDown',
  'fa-search-dollar': 'FiDollarSign',
  'fa-book-open': 'FiBookOpen',
  'fa-clipboard-list': 'FiClipboard',
  'fa-copy': 'FiCopy',
  'fa-file-contract': 'FiFileText',
  'fa-hashtag': 'FiHash',
  'fa-history': 'FiClock',
  'fa-map-marker-alt': 'FiMapPin',
  'fa-tags': 'FiTag',
  'fa-chart-pie': 'FiPieChart',
  'fa-truck-loading': 'FiTruck',
  'fa-user-circle': 'FiUser',
  'fa-tools': 'FiTool',
  'fa-box-open': 'FiPackage',
  'fa-chevron-left': 'FiChevronLeft',
  'fa-chevron-right': 'FiChevronRight',
  'fa-exchange-alt': 'FiRefreshCw',
  'fa-shopping-cart': 'FiShoppingCart',
  'fa-network-wired': 'FiShare2',
  'fa-wave-square': 'FiActivity',
  'fa-phone': 'FiPhone',
  'fa-whatsapp': 'FiMessageCircle',
  'fa-envelope': 'FiMail',
  'fa-landmark': 'FiHome',
  'fa-globe-americas': 'FiGlobe',
  'fa-bars': 'FiMenu',
  'fa-eye': 'FiEye',
  'fa-file-invoice': 'FiFileText'
};

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all <i className="fa... "></i> or <i className="fa... " />
  // We need to match <FiX className="text-lg"  />
  // and <FiLoader className="animate-spin"  />
  
  const regex = /<i\s+className=(["'])([^"']*?fa-[^"']*?)\1\s*(title=(["'])[^"']*?\4)?\s*>\s*<\/i>|<i\s+className=(["'])([^"']*?fa-[^"']*?)\5\s*(title=(["'])[^"']*?\8)?\s*\/>/g;
  
  let match;
  let newContent = content;
  const iconsUsed = new Set();
  
  // We will replace using a replacer function
  newContent = newContent.replace(regex, (fullMatch, q1, cls1, title1, qTitle1, q2, cls2, title2, qTitle2) => {
    const cls = cls1 || cls2;
    const titleAttr = title1 || title2 || '';
    
    // Find the specific fa- class
    let iconName = 'FiCircle'; // default
    const isSpin = cls.includes('fa-spin');
    
    for (const [faClass, fiIcon] of Object.entries(iconMap)) {
      if (cls.includes(faClass)) {
        iconName = fiIcon;
        break;
      }
    }
    
    iconsUsed.add(iconName);
    
    // Remove fa- classes, fas, far, fab, fal
    let newCls = cls.replace(/\b(fas|far|fab|fal|fa-[a-z0-9-]+|fa-spin)\b/g, '').trim();
    if (isSpin) {
      newCls = (newCls + ' animate-spin').trim();
    }
    
    if (newCls) {
      return `<${iconName} className="${newCls}" ${titleAttr} />`;
    } else {
      return `<${iconName} ${titleAttr} />`;
    }
  });
  
  if (iconsUsed.size > 0) {
    // Check if react-icons/fi is already imported
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]react-icons\/fi['"];?/;
    const importMatch = newContent.match(importRegex);
    
    if (importMatch) {
      const existingIcons = importMatch[1].split(',').map(i => i.trim());
      for (const icon of iconsUsed) {
        if (!existingIcons.includes(icon)) {
          existingIcons.push(icon);
        }
      }
      newContent = newContent.replace(importRegex, `import { ${existingIcons.join(', ')} } from "react-icons/fi";`);
    } else {
      // Add import after the last import statement, or at the top
      const lastImportIndex = newContent.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLastImport = newContent.indexOf('\n', lastImportIndex);
        newContent = newContent.slice(0, endOfLastImport + 1) + `import { ${Array.from(iconsUsed).join(', ')} } from "react-icons/fi";\n` + newContent.slice(endOfLastImport + 1);
      } else {
        newContent = `import { ${Array.from(iconsUsed).join(', ')} } from "react-icons/fi";\n` + newContent;
}
    }
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDir(filePath);
      }
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      processFile(filePath);
    }
  }
}

walkDir('./');
