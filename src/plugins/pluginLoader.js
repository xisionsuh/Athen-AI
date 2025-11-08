/**
 * 플러그인 로더
 * 플러그인을 동적으로 로드하고 관리합니다
 */

import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PluginLoader {
  constructor(pluginsDir = null) {
    this.pluginsDir = pluginsDir || path.join(__dirname, '../../plugins');
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * 플러그인 디렉토리에서 플러그인 로드
   */
  async loadPlugins() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      logger.info('Plugins directory created', { path: this.pluginsDir });
      return;
    }

    const files = fs.readdirSync(this.pluginsDir);
    const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

    for (const file of pluginFiles) {
      try {
        await this.loadPlugin(path.join(this.pluginsDir, file));
      } catch (error) {
        logger.error('Failed to load plugin', error, { file });
      }
    }

    logger.info('Plugins loaded', { count: this.plugins.size });
  }

  /**
   * 단일 플러그인 로드
   */
  async loadPlugin(pluginPath) {
    try {
      const pluginModule = await import(`file://${pluginPath}`);
      const PluginClass = pluginModule.default || pluginModule.Plugin;

      if (!PluginClass) {
        logger.warn('Plugin class not found, skipping', { path: pluginPath });
        return null;
      }

      const plugin = new PluginClass();
      
      // initialize 메서드가 있으면 호출, 없으면 onLoad 호출
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize({ pluginsDir: this.pluginsDir });
      } else if (typeof plugin.onLoad === 'function') {
        await plugin.onLoad();
      }

      // enabled 속성이 없으면 기본값 true 설정
      if (plugin.enabled === undefined) {
        plugin.enabled = true;
      }

      this.plugins.set(plugin.name, plugin);
      logger.info('Plugin loaded', { name: plugin.name, version: plugin.version || '1.0.0' });

      return plugin;
    } catch (error) {
      logger.error('Failed to load plugin', error, { path: pluginPath });
      // 에러가 발생해도 서버 시작은 계속되도록
      return null;
    }
  }

  /**
   * 플러그인 활성화
   */
  async activatePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (typeof plugin.activate === 'function') {
      await plugin.activate();
    } else if (typeof plugin.enable === 'function') {
      plugin.enable();
    } else {
      plugin.enabled = true;
    }
    
    logger.info('Plugin activated', { name: pluginName });
  }

  /**
   * 플러그인 비활성화
   */
  async deactivatePlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (typeof plugin.deactivate === 'function') {
      await plugin.deactivate();
    } else if (typeof plugin.disable === 'function') {
      plugin.disable();
    } else {
      plugin.enabled = false;
    }
    
    logger.info('Plugin deactivated', { name: pluginName });
  }

  /**
   * 모든 플러그인 목록 조회
   */
  getPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      enabled: p.enabled
    }));
  }

  /**
   * 훅 실행 (모든 활성화된 플러그인에서)
   */
  async executeHook(hookName, ...args) {
    let result = args[0];

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) {
        continue;
      }

      try {
        // 플러그인이 직접 훅 메서드를 가지고 있는 경우 (beforeMessage, afterMessage 등)
        if (typeof plugin[hookName] === 'function') {
          result = await plugin[hookName](result, ...args.slice(1));
        }
        // 또는 hooks 객체를 통해 등록된 경우
        else if (plugin.hooks && plugin.hooks[hookName]) {
          result = await plugin.executeHook(hookName, result, ...args.slice(1));
        }
      } catch (error) {
        logger.error('Hook execution failed', error, {
          plugin: plugin.name,
          hook: hookName
        });
      }
    }

    return result;
  }

  /**
   * 플러그인 정리
   */
  async cleanup() {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.cleanup();
      } catch (error) {
        logger.error('Plugin cleanup failed', error, { name: plugin.name });
      }
    }
    this.plugins.clear();
  }
}

