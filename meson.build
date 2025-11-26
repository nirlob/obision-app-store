project('obision-store', version: '1.0.0', meson_version: '>= 0.59.0')

application_id = 'com.obision.ObisionStore'
app_name = 'obision-store'

prefix = get_option('prefix')
bindir = prefix / get_option('bindir')
datadir = prefix / get_option('datadir')
schemadir = datadir / 'glib-2.0' / 'schemas'

# Install the compiled main.js
install_data(
  'builddir/main.js',
  install_dir: bindir,
  rename: app_name,
  install_mode: 'rwxr-xr-x'
)

# Install desktop file
install_data(
  'data' / application_id + '.desktop.in',
  install_dir: datadir / 'applications',
  rename: application_id + '.desktop'
)

# Install GSettings schema
install_data(
  'data' / application_id + '.gschema.xml',
  install_dir: schemadir
)

# Install CSS and other data files
install_subdir(
  'data',
  install_dir: datadir / application_id,
  exclude_files: [
    application_id + '.desktop.in',
    application_id + '.gschema.xml',
    application_id + '.gresource.xml'
  ]
)

# Compile GSettings schemas after installation
meson.add_install_script('glib-compile-schemas', schemadir)
