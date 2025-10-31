export default {
    template: `
      <div class="d-flex w-100">
        <!-- Skeleton Sidebar -->
        <nav class="sidebar border-end d-flex flex-column p-3 skeleton">
            <div class="sidebar-header mb-3"><div class="placeholder w-75"></div></div>
            <div class="sidebar-nav flex-fill">
                <div class="placeholder-glow"><span class="placeholder col-12 mb-2"></span></div>
                <div class="placeholder-glow"><span class="placeholder col-12 mb-2"></span></div>
                <div class="placeholder-glow"><span class="placeholder col-12 mb-2"></span></div>
            </div>
            <div class="sidebar-footer pt-3 border-top"><div class="placeholder w-50"></div></div>
        </nav>
  
        <!-- Skeleton Main Content -->
        <main class="main-content flex-fill">
          <div class="content-toolbar d-flex justify-content-between align-items-center p-3 border-bottom">
              <div class="placeholder-glow w-50"><span class="placeholder col-12"></span></div>
              <div class="d-flex gap-2">
                  <div class="placeholder" style="width: 40px; height: 38px;"></div>
                  <div class="placeholder" style="width: 40px; height: 38px;"></div>
              </div>
          </div>
          <div class="notes-list-container p-3">
            <div class="row g-3">
              <div v-for="n in 6" class="col-md-6 col-lg-4">
                <div class="card placeholder-glow" aria-hidden="true">
                  <div class="card-body">
                    <h5 class="card-title placeholder col-6"></h5>
                    <p class="card-text placeholder col-7"></p>
                    <p class="card-text placeholder col-4"></p>
                    <p class="card-text placeholder col-8"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      `,
  };