/**
 * 플러그인 기본 클래스
 * 모든 플러그인은 이 클래스를 상속받아야 합니다
 */

export class PluginBase {
  constructor(name, version, description) {
    this.name = name;
    this.version = version;
    this.description = description;
    this.enabled = true;
    this.hooks = {};
  }

  /**
   * 플러그인 초기화
   */
  async initialize(config) {
    // 하위 클래스에서 구현
  }

  /**
   * 플러그인 활성화
   */
  async activate() {
    this.enabled = true;
  }

  /**
   * 플러그인 비활성화
   */
  async deactivate() {
    this.enabled = false;
  }

  /**
   * 플러그인 정리
   */
  async cleanup() {
    // 하위 클래스에서 구현
  }

  /**
   * 훅 등록
   */
  registerHook(hookName, callback) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
  }

  /**
   * 훅 실행
   */
  async executeHook(hookName, ...args) {
    if (!this.hooks[hookName] || !this.enabled) {
      return args[0]; // 기본값 반환
    }

    let result = args[0];
    for (const callback of this.hooks[hookName]) {
      result = await callback(result, ...args.slice(1));
    }
    return result;
  }
}

