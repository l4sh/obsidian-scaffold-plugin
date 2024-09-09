import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';


interface ScaffoldSettings {
    scaffoldFolder: string;
}


const DEFAULT_SETTINGS: ScaffoldSettings = {
    scaffoldFolder: 'Templates/Scaffold'
}


class ScaffoldFolderModal extends Modal {
    private plugin: ScaffoldPlugin;
    private folderSelector: HTMLSelectElement;
    private destinationInput: HTMLInputElement;
    private destinationFolder: string;

    constructor(app: App, plugin: ScaffoldPlugin, destinationFolder: string) {
        super(app);
        this.plugin = plugin;
        this.destinationFolder = destinationFolder;
    }

    async populateFolderSelector() {
        const scaffoldFolderPath = this.plugin.settings.scaffoldFolder;
        const scaffoldFolder = this.app.vault.getAbstractFileByPath(scaffoldFolderPath);

        if (scaffoldFolder instanceof TFolder) {
            for (const child of scaffoldFolder.children) {
                if (child instanceof TFolder) {
                    this.folderSelector.createEl('option', { text: child.name });
                }
            }
        } else {
            console.error('Scaffold folder path is not a folder:', scaffoldFolderPath);
        }
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Scaffold Folder' });

        // Create folder selector
        this.folderSelector = contentEl.createEl('select');
        this.folderSelector.style.width = '200px';
        this.folderSelector.style.margin = '0 10px';
        this.populateFolderSelector();

        // Create destination input
        this.destinationInput = contentEl.createEl('input', { type: 'text', placeholder: 'Destination folder' });
        this.destinationInput.style.width = '200px';
        this.destinationInput.style.margin = '0 10px';
        this.destinationInput.value = this.destinationFolder;

        // Create confirm button
        const confirmButton = contentEl.createEl('button', { text: 'Create' });
        confirmButton.classList.add('mod-cta'); // Apply the accent color
        confirmButton.style.margin = '0 10px';

        confirmButton.addEventListener('click', () => {
            const selectedFolder = this.folderSelector.value;
            const destinationFolder = this.destinationInput.value;
            this.plugin.createScaffold(selectedFolder, destinationFolder);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class ScaffoldPlugin extends Plugin {
    settings: ScaffoldSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'scaffold-folder',
            name: 'Scaffold folder',
            callback: () => {
                new ScaffoldFolderModal(this.app, this, '').open();
            }
        });

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item.setTitle('Scaffold')
                            .setIcon('construction')
                            .onClick(() => {
                                new ScaffoldFolderModal(this.app, this, file.path).open();
                            });
                    });
                }
            })
        );

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new ScaffoldSettingTab(this.app, this));

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            console.log('click', evt);
        });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async createScaffold(originFolder: string, destinationFolder: string) {
        const scaffoldFolderPath = this.settings.scaffoldFolder;
        const sourcePath = `${scaffoldFolderPath}/${originFolder}`;
        const sourceFolder = this.app.vault.getAbstractFileByPath(sourcePath);

        if (sourceFolder instanceof TFolder) {
            await this.copyFolderContents(sourceFolder, destinationFolder);
        } else {
            console.error('Source path is not a folder:', sourcePath);
        }
    }

    async copyFolderContents(sourceFolder: TFolder, destinationPath: string) {
        if (!await this.app.vault.adapter.exists(destinationPath)) {
            await this.app.vault.createFolder(destinationPath);
        }

        for (const child of sourceFolder.children) {
            const childDestinationPath = `${destinationPath}/${child.name}`;
            if (child instanceof TFolder) {
                await this.app.vault.createFolder(childDestinationPath);
                await this.copyFolderContents(child, childDestinationPath);
            } else if (child instanceof TFile) {
                const content = await this.app.vault.read(child);
                await this.app.vault.create(childDestinationPath, content);
            }
        }
    }
}


class ScaffoldSettingTab extends PluginSettingTab {
    plugin: ScaffoldPlugin;

    constructor(app: App, plugin: ScaffoldPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        // TODO: Add folder suggestion
        new Setting(containerEl)
            .setName('Scaffold folder location')
            .setDesc('Files structures in this folder will be available for scaffolding')
            .addText(text => text
                .setPlaceholder('Enter your scaffold folder location')
                .setValue(this.plugin.settings.scaffoldFolder)
                .onChange(async (value) => {
                    this.plugin.settings.scaffoldFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
