export const StorageKeys = {
	THEME: '__style_manager_theme',
	APPEARANCE: '__style_manager_appearance',
	SNIPPETS: '__style_manager_snippets',
	ACCENT_COLOR: '__style_manager_accent_color',
} as const;
export const NotificationKeys = {
	SHOW_SHARED_NOTIFICATIONS: '__style_manager_show_shared_notifications',
	SHOW_PRESET_NOTIFICATIONS: '__style_manager_show_preset_notifications',
	SHOW_ISOLATE_NOTIFICATIONS: '__style_manager_show_isolate_notifications',
	SHOW_SNIPPET_NOTIFICATIONS: '__style_manager_show_snippet_notifications',
	SHOW_UTILITY_NOTIFICATIONS: '__style_manager_show_utility_notifications',
} as const;
export const ExportKeys = {
	EXPORT_PATH: '__style_manager_export_path',
	EXPORT_EXTENSION: '__style_manager_export_extension',
	EXPORT_DATE_FORMAT: '__style_manager_export_date_format',
	CREATED_DATE_FORMAT: '__style_manager_created_date_format',
} as const;
export const ConfirmKeys = {
	SKIP_DELETE_CONFIRM: '__style_manager_skip_delete_confirm',
	SKIP_EXPORT_CONFIRM: '__style_manager_skip_export_confirm',
	SKIP_IMPORT_CONFIRM: '__style_manager_skip_import_confirm',
} as const;
export const ToolKeys = {
	TOOL_FREEZE_DELAY: '__style_manager_tool_freeze_delay',
	TOOL_BOX_OUTLINE_COLOR: '__style_manager_tool_box_outline_color',
} as const;
export const BackupKeys = {
	BACKUP_PATH: '__style_manager_backup_path',
	BACKUP_DATE_FORMAT: '__style_manager_backup_date_format',
} as const;
export const PreferencesKeys = {
	OPEN_MODAL_ON_CREATE: '__style_manager_open_modal_on_create',
	EDITOR_TAB_SIZE: '__style_manager_editor_tab_size',
	ENABLE_CONSOLE_LOGGING: '__style_manager_enable_console_logging',
	SEPARATE_BULK_PRESETS: '__style_manager_separate_bulk_presets',
	STICKY_HEADING: '__style_manager_sticky_heading',
	ALWAYS_SHARED_PRESETS: '__style_manager_always_shared_presets',
	OPEN_IN_DEFAULT_APP: '__style_manager_open_in_default_app',
	PRESET_APPLY_ACTION: '__style_manager_preset_apply_action',
	BULK_PRESET_APPLY_ACTION: '__style_manager_bulk_preset_apply_action',
	SCHEDULE_APPLY_ACTION: '__style_manager_schedule_apply_action',
	SETTINGS_BLOCK_DASH_SPACES: '__style_manager_settings_block_dash_spaces',
	SETTINGS_BLOCK_COMPONENT_SPACES:
		'__style_manager_settings_block_component_spaces',
	SHOW_PARSE_LOGS_ICON: '__style_manager_show_parse_logs_icon',
	SHOW_STATUS_BAR: '__style_manager_show_status_bar',
	SHOW_SNIPPET_METADATA: '__style_manager_show_snippet_metadata',
} as const;
