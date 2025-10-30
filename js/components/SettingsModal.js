export default {
    props: ['modelValue', 'currentTheme', 'saveVoiceRecordings'], // Use v-model for two-way binding and current theme
    emits: ['update:modelValue', 'update:theme', 'update:saveVoiceRecordings', 'close'],
    data() {
        return {
            selectedTheme: this.currentTheme,
            handsFreeEnabled: this.modelValue,
            voiceRecordingsEnabled: this.saveVoiceRecordings
        };
    },
    watch: {
        currentTheme(newVal) {
            this.selectedTheme = newVal;
        },
        modelValue(newVal) {
            this.handsFreeEnabled = newVal;
        },
        saveVoiceRecordings(newVal) {
            this.voiceRecordingsEnabled = newVal;
        }
    },
    template: `
          <div class="modal fade show d-block" style="background-color: rgba(0,0,0,0.5);" @click.self="$emit('close')">
              <div class="modal-dialog">
                  <div class="modal-content">
                      <div class="modal-header">
                          <h5 class="modal-title">Settings</h5>
                          <button type="button" class="btn-close" @click="$emit('close')"></button>
                      </div>
                      <div class="modal-body">
                          <!-- Theme Selection -->
                          <div class="mb-4">
                              <label class="form-label fw-semibold">Theme</label>
                              <div class="row g-2">
                                  <div class="col-4">
                                      <div class="form-check">
                                          <input class="form-check-input" type="radio" name="theme" value="light" v-model="selectedTheme" @change="$emit('update:theme', selectedTheme)" id="theme-light">
                                          <label class="form-check-label" for="theme-light">
                                              <i class="bi bi-sun me-2"></i>Light
                                          </label>
                                      </div>
                                  </div>
                                  <div class="col-4">
                                      <div class="form-check">
                                          <input class="form-check-input" type="radio" name="theme" value="dark" v-model="selectedTheme" @change="$emit('update:theme', selectedTheme)" id="theme-dark">
                                          <label class="form-check-label" for="theme-dark">
                                              <i class="bi bi-moon me-2"></i>Dark
                                          </label>
                                      </div>
                                  </div>
                                  <div class="col-4">
                                      <div class="form-check">
                                          <input class="form-check-input" type="radio" name="theme" value="auto" v-model="selectedTheme" @change="$emit('update:theme', selectedTheme)" id="theme-auto">
                                          <label class="form-check-label" for="theme-auto">
                                              <i class="bi bi-circle-half me-2"></i>Auto
                                          </label>
                                      </div>
                                  </div>
                              </div>
                              <small class="text-muted">Choose your preferred theme or let the system decide.</small>
                          </div>

                          <!-- Hands-Free Mode -->
                          <div class="mb-3">
                              <label for="hands-free-toggle" class="form-check-label fw-semibold">Hands-Free Mode</label>
                              <div class="form-check form-switch">
                                  <input class="form-check-input" type="checkbox" id="hands-free-toggle" v-model="handsFreeEnabled" @change="$emit('update:modelValue', handsFreeEnabled)">
                              </div>
                              <small class="text-muted">Enable "Hey Notes" voice commands.</small>
                          </div>

                          <!-- Save Voice Recordings -->
                          <div class="mb-3">
                              <label for="save-recordings-toggle" class="form-check-label fw-semibold">Save Voice Recordings</label>
                              <div class="form-check form-switch">
                                  <input class="form-check-input" type="checkbox" id="save-recordings-toggle" v-model="voiceRecordingsEnabled" @change="$emit('update:saveVoiceRecordings', voiceRecordingsEnabled)">
                              </div>
                              <small class="text-muted">Save audio recordings with voice notes.</small>
                          </div>
                          </div>
                      <div class="modal-footer">
                          <button type="button" class="btn btn-secondary" @click="$emit('close')">Close</button>
                      </div>
                  </div>
              </div>
          </div>
      `,
};