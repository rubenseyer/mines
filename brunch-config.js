exports.config = {
    paths: {
        watched: ['app', 'lib'],
    },
    files: {
        javascripts: {
            joinTo: {
                'vendor.js': /^lib\/vendor\//,
            },
            entryPoints: {
                'app/main.js': {
                    'lib.js': /^(?!app\/)/,
                    'app.js': /^app\//,
                },
            },
        },
        stylesheets: {
            joinTo: 'app.css',
        },
    },
    plugins: {
        uglify: {mangle: true},
    },
}

exports.plugins = {
    babel: {presets: ['env'], targets: {browsers: ['last 2 chrome versions', 'last 2 firefox versions', 'last 2 edge versions', 'safari >= 11']}},
}
