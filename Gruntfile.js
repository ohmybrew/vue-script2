var fs = require('fs');

module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  var pkg = grunt.file.readJSON('package.json');
  var file = pkg['jsnext:main'];
  var main = fs.readFileSync(file, 'utf-8');
  var v1 = main.match(/version: '([\d\.]+)'/)[1];

  if (v1 !== pkg.version) {
    console.log(`Updating version in ${file}: ${v1} => ${pkg.version}`);

    main = main.replace(`version: '${v1}'`, `version: '${pkg.version}'`);
    fs.writeFileSync(file, main);
  }

  var year = new Date().getFullYear();
  year = year === 2016 ? year : `2016-${year}`;
  var banner = `/*!;
  * ${pkg.name} v${pkg.version}
  * (c) ${year} Greg Slepak
  * @license MIT License
  */`;

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    babel: {
      options: {
        presets: ['es2015'],
      },
      js: {
        files: {
          'dist/vue-script2.js': 'src/index.js',
        },
      },
    },
    uglify: {
      options: {
        banner: banner,
      },
      js: {
        files: {
          'dist/vue-script2.min.js': 'dist/vue-script2.js',
        },
      },
    },
  });

  grunt.registerTask('default', ['babel', 'uglify']);
};
