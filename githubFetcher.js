class GitHubRepositoryFetcher {
  constructor() {
      this.username = "antonsmedberg";
      this.selectedRepos = [
          "projekt-del-2-Ai",
          "Scrollable_Top_Bottom_Bar.kt",
          "Mocka_Axios",
          "Avancerad-java-Anton-Smedberg-slutprojekt",
          "3d_Particle_Cloud_Anton",
          "mazeAlgoritm"
      ];
      this.elements = {
          container: document.getElementById("github-projects"),
          loading: document.getElementById("loading"),
          error: document.getElementById("error-message")
      };
  }

  async fetchRepositories() {
      this.showLoading();
      try {
          const repos = await this.getRepositoriesFromAPI();
          const filteredRepos = this.filterSelectedRepos(repos);
          await this.displayRepositories(filteredRepos);
      } catch (error) {
          this.handleError(error);
      }
  }

  async getRepositoriesFromAPI() {
      const apiUrl = `https://api.github.com/users/${this.username}/repos?sort=updated&per_page=20`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
          throw new Error(`GitHub API failed: ${response.status}`);
      }
      
      return await response.json();
  }

  filterSelectedRepos(repos) {
      return repos.filter(repo => this.selectedRepos.includes(repo.name));
  }

  createRepositoryCard(repo) {
      return `
          <div class="relative bg-gray-900/90 backdrop-blur-lg rounded-xl p-6 shadow-lg border border-gray-800 hover:border-blue-500 transition hover:shadow-xl flex flex-col justify-between h-[240px] group">
              <div>
                  <div class="flex items-center space-x-3">
                      <div class="icon-wrapper">
                          <i data-lucide="folder" class="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform"></i>
                      </div>
                      <h4 class="text-xl font-semibold text-gray-100 truncate group-hover:text-white transition-colors">
                          ${repo.name}
                      </h4>
                  </div>
                  <p class="text-gray-400 mt-2 text-sm line-clamp-3 h-[60px] overflow-hidden group-hover:text-gray-300 transition-colors">
                      ${this.getDescription(repo)}
                  </p>
              </div>

              <div class="mt-4 flex items-center justify-between">
                  ${this.createLanguageBadge(repo)}
                  ${this.createMetadataBadges(repo)}
                  ${this.createLinkButton(repo)}
              </div>
          </div>
      `;
  }

  getDescription(repo) {
      return repo.description || "<span class='italic text-gray-500'>No description available.</span>";
  }

  createLanguageBadge(repo) {
      return repo.language ? 
          `<span class="px-3 py-1 text-xs font-medium rounded-md bg-gray-700 text-white flex items-center">
              <span class="w-2 h-2 rounded-full ${this.getLanguageColor(repo.language)} mr-2"></span>
              ${repo.language}
          </span>` : '';
  }

  createMetadataBadges(repo) {
      return `
          <div class="flex items-center space-x-4">
              ${repo.stargazers_count > 0 ? 
                  `<span class="flex items-center text-gray-400 text-xs">
                      <i data-lucide="star" class="w-4 h-4 mr-1"></i>
                      ${repo.stargazers_count}
                  </span>` : ''
              }
              ${repo.forks_count > 0 ? 
                  `<span class="flex items-center text-gray-400 text-xs">
                      <i data-lucide="git-fork" class="w-4 h-4 mr-1"></i>
                      ${repo.forks_count}
                  </span>` : ''
              }
          </div>
      `;
  }

  createLinkButton(repo) {
      return `
          <a href="${repo.html_url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="flex items-center space-x-2 text-blue-500 hover:text-blue-400 transition p-2 rounded-full hover:bg-white/5"
             aria-label="View repository on GitHub">
              <div class="icon-wrapper">
                  <i data-lucide="external-link" class="w-6 h-6"></i>
              </div>
          </a>
      `;
  }

  getLanguageColor(language) {
      const colors = {
          JavaScript: 'bg-yellow-400',
          Python: 'bg-blue-400',
          Java: 'bg-red-400',
          Kotlin: 'bg-purple-400',
          HTML: 'bg-orange-400',
          CSS: 'bg-blue-400',
          TypeScript: 'bg-blue-600',
          default: 'bg-gray-400'
      };
      return colors[language] || colors.default;
  }

  async displayRepositories(repos) {
      this.hideLoading();
      this.elements.container.innerHTML = repos.map(repo => this.createRepositoryCard(repo)).join("");

      // ✅ Ensure icons are re-rendered after projects load
      document.dispatchEvent(new Event("icons-loaded"));

      // ✅ Directly initialize Lucide icons without `iconManager.js`
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
          console.log("✅ Lucide icons rendered successfully.");
      } else {
          console.error("❌ Lucide is not loaded.");
      }
  }

  showLoading() {
      this.elements.loading.style.display = "grid";
      this.elements.error.style.display = "none";
  }

  hideLoading() {
      this.elements.loading.style.display = "none";
  }

  handleError(error) {
      console.error("Error fetching GitHub repositories:", error);
      this.hideLoading();
      this.elements.error.style.display = "block";
      this.elements.error.innerHTML = `
          <div class="text-center">
              <p class="text-red-500 text-lg mb-4">Failed to load projects. Please try again.</p>
              <button onclick="window.githubFetcher.fetchRepositories()" 
                      class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  Retry
              </button>
          </div>
      `;
  }
}

// Initialize and fetch repositories
const githubFetcher = new GitHubRepositoryFetcher();
window.githubFetcher = githubFetcher;

document.addEventListener('DOMContentLoaded', async () => {
    await githubFetcher.fetchRepositories();
});
