import fs from 'node:fs';
import path from 'node:path';

export function attachSkill(session, skillId) {
  if (!session.skills.includes(skillId)) {
    session.skills.push(skillId);
  }
}

export function detachSkill(session, skillId) {
  session.skills = session.skills.filter(id => id !== skillId);
}

export function skillFilePath(baseDir, skill) {
  return path.join(baseDir, skill.entry);
}

export function loadSkillContent(baseDir, skill) {
  return fs.readFileSync(skillFilePath(baseDir, skill), 'utf-8');
}

export function buildSkillMessages(session, registry, baseDir) {
  const messages = [];

  for (const skillId of session.skills) {
    if (session.skill_state.injected.includes(skillId)) {
      continue;
    }

    const skill = registry.skills.find(entry => entry.id === skillId);
    if (!skill) {
      continue;
    }

    const content = loadSkillContent(baseDir, skill);
    messages.push({
      role: 'user',
      content,
    });
    session.skill_state.injected.push(skillId);
  }

  return messages;
}
