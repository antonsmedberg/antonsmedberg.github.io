import React, { useState, useEffect } from 'react';
import { Menu, X, Github, Linkedin, Mail, ExternalLink } from 'lucide-react';

const Portfolio = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = ['About', 'Skills', 'Projects', 'Contact'];
  
  const skills = [
    { name: 'SwiftUI', level: 'Advanced' },
    { name: 'Kotlin', level: 'Advanced' },
    { name: 'iOS Development', level: 'Advanced' },
    { name: 'Clean Architecture', level: 'Intermediate' },
  ];

  const projects = [
    {
      title: 'MapSwe',
      description: 'A location-based Android app built with Kotlin, featuring real-time updates and custom map overlays.',
      tags: ['Kotlin', 'Android', 'Maps API'],
      category: 'android'
    },
    {
      title: 'SwiftTask',
      description: 'An iOS task management app built with SwiftUI, incorporating CoreData and CloudKit for seamless sync.',
      tags: ['SwiftUI', 'iOS', 'CoreData'],
      category: 'ios'
    },
    {
      title: 'FitTrack',
      description: 'A cross-platform fitness tracking app developed using Kotlin Multiplatform, with HealthKit integration.',
      tags: ['Kotlin', 'iOS', 'Android'],
      category: 'cross-platform'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-2xl font-bold text-gray-800">AS</span>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-8">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-gray-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="block px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">Anton Smedberg</h1>
          <p className="text-xl text-gray-600 mb-8">Mobile App Developer | SwiftUI & Kotlin Expert</p>
          <a
            href="#projects"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View My Work
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">About Me</h2>
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="w-full md:w-1/2">
              <img
                src="/api/placeholder/400/400"
                alt="Profile"
                className="rounded-lg shadow-lg w-full"
              />
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              <p className="text-gray-600">
                Hello! I'm Anton, a passionate mobile app developer specializing in SwiftUI and Kotlin. 
                With experience in crafting intuitive and powerful applications, I bring ideas to life 
                through clean code and stunning design.
              </p>
              <p className="text-gray-600">
                My journey in tech has led me to work on diverse projects, from startup MVPs to 
                enterprise-level applications. I'm constantly learning and adapting to new technologies 
                to stay at the forefront of mobile development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Skills</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{skill.name}</h3>
                <p className="text-gray-600">{skill.level}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Featured Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div
                key={project.title}
                className="bg-gray-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <img
                  src="/api/placeholder/300/200"
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Get In Touch</h2>
          <div className="flex justify-center space-x-8">
            <a
              href="https://github.com/antonsmedberg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Github size={24} />
            </a>
            <a
              href="https://www.linkedin.com/in/anton-smedberg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Linkedin size={24} />
            </a>
            <a
              href="mailto:contact@example.com"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Mail size={24} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} Anton Smedberg. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Portfolio;
