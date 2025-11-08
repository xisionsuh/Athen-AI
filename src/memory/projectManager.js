import { getDatabase } from '../database/schema.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProjectManager {
  constructor(dbPath = './data/athena.db') {
    this.db = getDatabase(dbPath);
    this.projectsDir = path.join(process.cwd(), 'projects');
    
    // projects 디렉토리 생성
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  /**
   * 프로젝트 생성
   */
  createProject(userId, name, description = '') {
    const projectId = crypto.randomUUID();
    const projectDir = path.join(this.projectsDir, projectId);
    
    // 프로젝트 디렉토리 생성
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, user_id, name, description)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(projectId, userId, name, description);
    
    logger.info('Project created', { projectId, userId, name });
    
    return {
      id: projectId,
      userId,
      name,
      description,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 프로젝트 조회
   */
  getProject(projectId) {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    
    const project = stmt.get(projectId);
    if (!project) return null;

    return {
      id: project.id,
      userId: project.user_id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    };
  }

  /**
   * 사용자의 모든 프로젝트 조회
   */
  getUserProjects(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM projects 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `);
    
    return stmt.all(userId).map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  }

  /**
   * 프로젝트 삭제
   */
  deleteProject(projectId) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // 프로젝트 디렉토리 삭제
    const projectDir = path.join(this.projectsDir, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    // DB에서 삭제 (CASCADE로 파일도 자동 삭제됨)
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(projectId);
    
    logger.info('Project deleted', { projectId });
  }

  /**
   * 프로젝트에 파일 추가
   */
  async addFileToProject(projectId, filePath, fileName, mimeType, fileSize) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const projectDir = path.join(this.projectsDir, projectId);
    const targetPath = path.join(projectDir, fileName);
    
    // 파일을 프로젝트 디렉토리로 복사
    fs.copyFileSync(filePath, targetPath);

    // 파일 타입 결정
    const fileType = this.determineFileType(fileName, mimeType);
    
    // 텍스트 파일인 경우 내용 추출
    let contentText = null;
    if (this.isTextFile(fileName, mimeType)) {
      try {
        contentText = fs.readFileSync(targetPath, 'utf-8');
      } catch (error) {
        logger.warn('Failed to read file content', { fileName, error: error.message });
      }
    }

    // 메타데이터 저장
    const metadata = {
      originalPath: filePath,
      mimeType,
      fileSize
    };

    const stmt = this.db.prepare(`
      INSERT INTO project_files (project_id, file_name, file_path, file_type, file_size, mime_type, content_text, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      projectId,
      fileName,
      targetPath,
      fileType,
      fileSize,
      mimeType,
      contentText,
      JSON.stringify(metadata)
    );

    // 프로젝트 업데이트 시간 갱신
    this.db.prepare(`
      UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(projectId);

    logger.info('File added to project', { projectId, fileName, fileType });

    return {
      projectId,
      fileName,
      fileType,
      fileSize,
      hasContent: !!contentText
    };
  }

  /**
   * 프로젝트 파일 목록 조회
   */
  getProjectFiles(projectId) {
    const stmt = this.db.prepare(`
      SELECT * FROM project_files 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `);
    
    return stmt.all(projectId).map(f => ({
      id: f.id,
      projectId: f.project_id,
      fileName: f.file_name,
      filePath: f.file_path,
      fileType: f.file_type,
      fileSize: f.file_size,
      mimeType: f.mime_type,
      hasContent: !!f.content_text,
      createdAt: f.created_at,
      metadata: f.metadata ? JSON.parse(f.metadata) : null
    }));
  }

  /**
   * 프로젝트 파일 삭제
   */
  deleteProjectFile(fileId) {
    const stmt = this.db.prepare('SELECT * FROM project_files WHERE id = ?');
    const file = stmt.get(fileId);
    
    if (!file) {
      throw new Error('File not found');
    }

    // 파일 삭제
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // DB에서 삭제
    this.db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId);
    
    logger.info('File deleted from project', { fileId, fileName: file.file_name });
  }

  /**
   * 프로젝트의 모든 파일 내용을 컨텍스트로 가져오기
   */
  getProjectContext(projectId, maxFiles = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM project_files 
      WHERE project_id = ? 
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const files = stmt.all(projectId, maxFiles);
    const context = [];

    for (const file of files) {
      if (file.content_text) {
        // 텍스트 파일인 경우 내용 포함
        context.push({
          type: 'text',
          fileName: file.file_name,
          content: file.content_text
        });
      } else if (file.file_type === 'image') {
        // 이미지 파일인 경우 경로 포함
        context.push({
          type: 'image',
          fileName: file.file_name,
          path: file.file_path
        });
      } else {
        // 기타 파일은 파일명만 포함
        context.push({
          type: 'file',
          fileName: file.file_name,
          fileType: file.file_type
        });
      }
    }

    return context;
  }

  /**
   * 세션의 프로젝트 연결 해제
   */
  unlinkSessionFromProject(sessionId) {
    const stmt = this.db.prepare('DELETE FROM project_sessions WHERE session_id = ?');
    stmt.run(sessionId);
    logger.info('Session unlinked from project', { sessionId });
  }

  /**
   * 세션을 프로젝트에 연결
   */
  linkSessionToProject(sessionId, projectId) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_sessions (session_id, project_id)
      VALUES (?, ?)
    `);
    
    stmt.run(sessionId, projectId);
    
    logger.info('Session linked to project', { sessionId, projectId });
  }

  /**
   * 세션의 프로젝트 조회
   */
  getSessionProject(sessionId) {
    const stmt = this.db.prepare(`
      SELECT p.* FROM projects p
      INNER JOIN project_sessions ps ON p.id = ps.project_id
      WHERE ps.session_id = ?
    `);
    
    const project = stmt.get(sessionId);
    if (!project) return null;

    return {
      id: project.id,
      userId: project.user_id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    };
  }

  /**
   * 파일 타입 결정
   */
  determineFileType(fileName, mimeType) {
    const ext = path.extname(fileName).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext) || 
        mimeType?.startsWith('image/')) {
      return 'image';
    }
    
    if (['.pdf'].includes(ext) || mimeType === 'application/pdf') {
      return 'pdf';
    }
    
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext) || 
        mimeType?.startsWith('video/')) {
      return 'video';
    }
    
    if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt'].includes(ext)) {
      return 'code';
    }
    
    if (['.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.csv'].includes(ext) || 
        mimeType?.startsWith('text/')) {
      return 'text';
    }
    
    if (['.doc', '.docx'].includes(ext) || mimeType?.includes('word')) {
      return 'document';
    }
    
    return 'other';
  }

  /**
   * 텍스트 파일 여부 확인
   */
  isTextFile(fileName, mimeType) {
    const fileType = this.determineFileType(fileName, mimeType);
    return ['text', 'code'].includes(fileType) || mimeType?.startsWith('text/');
  }
}

