// js/services/openHelp.js
import { alertService } from './alert-service.js';

const helpContent = `
<div style="text-align: left; font-size: 0.9rem;">
  <h5 class="mb-3"><i class="bi bi-mic-fill me-2"></i>Voice Control Guide</h5>
  
  <h6 class="fw-bold">General Commands (Notes List View)</h6>
  <ul class="list-unstyled lh-lg">
    <li><i class="bi bi-plus-circle me-2 text-success"></i>To create a new note and start dictating: <br><em>"Create note" or "New note"</em></li>
    <li><i class="bi bi-pencil-square me-2 text-primary"></i>To create a note with a title: <br><em>"Create note titled <strong>My Meeting</strong> with content <strong>agenda items...</strong>"</em></li>
    <li><i class="bi bi-search me-2 text-primary"></i>To search: <em>"Search for <strong>AI project</strong>"</em></li>
    <li><i class="bi bi-trash me-2 text-primary"></i>To delete: <em>"Delete note <strong>My Meeting</strong>"</em></li>
  </ul>

  <h6 class="fw-bold mt-4">Dictation Control</h6>
  <ul class="list-unstyled lh-lg">
    <li><i class="bi bi-mic-fill me-2 text-success"></i>To start dictating: <em>"Start writing" or "Start dictating"</em></li>
    <li><i class="bi bi-mic-mute me-2 text-danger"></i>To stop dictating: <em>"Stop writing" or "Exit"</em></li>
  </ul>

  <h6 class="fw-bold mt-4">In-Editor Commands (Dictation Mode)</h6>
  <p class="small text-muted">While editing a note, you can format, edit, and manage your text with voice.</p>
  <div class="row">
    <div class="col-md-6">
      <strong>Formatting & Insertion:</strong>
      <ul class="list-unstyled lh-lg">
        <li><i class="bi bi-type-bold me-2"></i>"Make it bold"</li>
        <li><i class="bi bi-type-italic me-2"></i>"Italicize this"</li>
        <li><i class="bi bi-type-underline me-2"></i>"Underline this"</li>
        <li><i class="bi bi-list-task me-2"></i>"Add a task"</li>
        <li><i class="bi bi-list-ul me-2"></i>"Start bullet points"</li>
        <li><i class="bi bi-braces-asterisk me-2"></i>"Clear formatting"</li>
      </ul>
    </div>
    <div class="col-md-6">
      <strong>Editing & Actions:</strong>
      <ul class="list-unstyled lh-lg">
        <li><i class="bi bi-arrow-return-left me-2"></i>"Next line"</li>
        <li><i class="bi bi-scissors me-2"></i>"Delete last word"</li>
        <li><i class="bi bi-scissors me-2"></i>"Delete sentence"</li>
        <li><i class="bi bi-arrow-counterclockwise me-2"></i>"Undo that"</li>
        <li><i class="bi bi-arrow-clockwise me-2"></i>"Redo that"</li>
        <li><i class="bi bi-x-circle me-2"></i>"Close note" / "Finish note"</li>
      </ul>
    </div>
  </div>
  
  <h6 class="fw-bold mt-4">Chrome AI Features (In-Editor)</h6>
  <ul class="list-unstyled lh-lg">
    <li><i class="bi bi-card-text me-2 text-success"></i>To summarize: <em>"Summarize this note"</em></li>
    <li><i class="bi bi-spellcheck me-2 text-success"></i>To proofread: <em>"Check my writing"</em></li>
  </ul>
</div>
`;

export function openHelp() {
  alertService.info('Help & Voice Commands', helpContent, { confirmText: 'Got it!', cancelText: false });
}