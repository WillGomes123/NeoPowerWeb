          {/* Create/Edit Dialog */}
          <DialogContent className="bg-surface-container border-outline-variant/20 !p-0 overflow-hidden" style={{ maxWidth: '800px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="p-5 border-b border-outline-variant/10 shrink-0">
              <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">palette</span>
                Configurar Marca
              </DialogTitle>
              <DialogDescription className="text-on-surface-variant text-sm mt-1">
                Identidade visual do cliente no App
              </DialogDescription>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 p-5">
              <Tabs defaultValue="identity" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-surface-container-highest">
                  <TabsTrigger value="identity" className="data-[state=active]:bg-surface-container data-[state=active]:text-on-surface text-on-surface-variant font-bold">Identidade</TabsTrigger>
                  <TabsTrigger value="logos" className="data-[state=active]:bg-surface-container data-[state=active]:text-on-surface text-on-surface-variant font-bold">Logos</TabsTrigger>
                  <TabsTrigger value="colors" className="data-[state=active]:bg-surface-container data-[state=active]:text-on-surface text-on-surface-variant font-bold">Cores do App</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-6 mt-0 flex-1 overflow-y-auto outline-none pr-1">
                  {/* Identidade */}
                  <div className="space-y-3">
                    <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Informações Básicas</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest">ID (Slug)</Label>
                        <Input
                          placeholder="cliente-xyz"
                          value={formData.clientId}
                          onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Empresa (Opcional)</Label>
                        <Input
                          placeholder="Nome Exibido"
                          value={formData.companyName || ''}
                          onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Slogan (Opcional)</Label>
                      <Input
                        value={formData.slogan}
                        onChange={e => setFormData({ ...formData, slogan: e.target.value })}
                        className="bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Tema da Web */}
                  <div className="space-y-3 pt-2">
                    <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Tema Base da Plataforma Web</p>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, theme: 'dark' })}
                        className={`flex-1 flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          formData.theme === 'dark'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#0e0e0e] border border-[#494847] flex items-center justify-center">
                          <span className="text-[#39FF14] text-sm font-bold">A</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">Escuro</p>
                          <p className="text-xs text-on-surface-variant">Fundo escuro, texto claro</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, theme: 'light' })}
                        className={`flex-1 flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          formData.theme === 'light'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#f0f2f5] border border-[#d1d5db] flex items-center justify-center">
                          <span className="text-[#111827] text-sm font-bold">A</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">Claro</p>
                          <p className="text-xs text-on-surface-variant">Fundo claro, texto escuro</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logos" className="space-y-6 mt-0 flex-1 overflow-y-auto outline-none pr-1">
                  {/* Logo */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Logo do App</p>
                      <div className="flex gap-2 bg-surface-container-highest p-1 rounded-lg">
                        <button
                          onClick={() => setFormData({ ...formData, logoType: 'programmatic' })}
                          className={`py-1.5 px-4 rounded-md text-xs font-bold transition-all ${formData.logoType === 'programmatic' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Ícone Padrão
                        </button>
                        <button
                          onClick={() => setFormData({ ...formData, logoType: 'image' })}
                          className={`py-1.5 px-4 rounded-md text-xs font-bold transition-all ${formData.logoType === 'image' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Upload Customizado
                        </button>
                      </div>
                    </div>

                    {formData.logoType === 'image' && (
                      <div className="space-y-5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                        {/* Logo Padrão */}
                        <div className="space-y-2">
                          <Label className="text-on-surface-variant text-xs font-bold">Logo Padrão (Obrigatório)</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="URL da logo ou faça upload"
                              value={formData.logoUri}
                              onChange={e => setFormData({ ...formData, logoUri: e.target.value })}
                              className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm flex-1"
                            />
                            <div className="relative">
                              <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUri')} disabled={uploadingLogo} />
                              <button
                                type="button"
                                className="h-10 px-4 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                                disabled={uploadingLogo}
                              >
                                {uploadingLogo ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                ) : (
                                  <span className="material-symbols-outlined text-lg">upload</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Logo Tema Claro */}
                          <div className="space-y-2">
                            <Label className="text-on-surface-variant text-xs font-bold">Logo Claro (Opcional)</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="URL da logo para tema claro"
                                value={formData.logoUriLight}
                                onChange={e => setFormData({ ...formData, logoUriLight: e.target.value })}
                                className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm flex-1"
                              />
                              <div className="relative">
                                <input type="file" id="logo-light-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUriLight')} disabled={uploadingLogo} />
                                <button
                                  type="button"
                                  className="h-10 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                                  onClick={() => document.getElementById('logo-light-upload')?.click()}
                                  disabled={uploadingLogo}
                                >
                                  {uploadingLogo ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                  ) : (
                                    <span className="material-symbols-outlined text-lg">upload</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Logo Tema Escuro */}
                          <div className="space-y-2">
                            <Label className="text-on-surface-variant text-xs font-bold">Logo Escuro (Opcional)</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="URL da logo para tema escuro"
                                value={formData.logoUriDark}
                                onChange={e => setFormData({ ...formData, logoUriDark: e.target.value })}
                                className="bg-surface-container border-outline-variant/20 text-on-surface h-10 text-sm flex-1"
                              />
                              <div className="relative">
                                <input type="file" id="logo-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUriDark')} disabled={uploadingLogo} />
                                <button
                                  type="button"
                                  className="h-10 px-3 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                                  onClick={() => document.getElementById('logo-dark-upload')?.click()}
                                  disabled={uploadingLogo}
                                >
                                  {uploadingLogo ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                  ) : (
                                    <span className="material-symbols-outlined text-lg">upload</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Previews */}
                        <div className="grid grid-cols-3 gap-4 pt-2">
                          {formData.logoUri && (
                            <div className="flex flex-col items-center gap-2 p-3 bg-surface-container rounded-lg border border-outline-variant/10">
                              <Label className="text-[10px] text-on-surface-variant uppercase font-bold">Padrão</Label>
                              <img src={formData.logoUri} alt="Logo" className="w-12 h-12 rounded object-contain bg-white" />
                            </div>
                          )}
                          {formData.logoUriLight && (
                            <div className="flex flex-col items-center gap-2 p-3 bg-slate-200 rounded-lg border border-outline-variant/10">
                              <Label className="text-[10px] text-black uppercase font-bold">Claro (Fundo Cinza)</Label>
                              <img src={formData.logoUriLight} alt="Logo Claro" className="w-12 h-12 rounded object-contain" />
                            </div>
                          )}
                          {formData.logoUriDark && (
                            <div className="flex flex-col items-center gap-2 p-3 bg-slate-800 rounded-lg border border-outline-variant/10">
                              <Label className="text-[10px] text-white uppercase font-bold">Escuro (Fundo Preto)</Label>
                              <img src={formData.logoUriDark} alt="Logo Escuro" className="w-12 h-12 rounded object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Splash Screen */}
                  <div className="space-y-3 pt-2 border-t border-outline-variant/10">
                    <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold mt-4">Splash Screen do App</p>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="URL da splash ou faça upload"
                          value={formData.splashUri || ''}
                          onChange={e => setFormData({ ...formData, splashUri: e.target.value })}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm flex-1"
                        />
                        <div className="relative">
                          <input
                            type="file" id="splash-upload" className="hidden" accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
                              if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
                              setUploadingLogo(true);
                              const fd = new FormData();
                              fd.append('files', file);
                              try {
                                const res = await api.post('/admin/branding/upload', fd);
                                if (res.ok) {
                                  const data = await res.json();
                                  setFormData(prev => ({ ...prev, splashUri: data.url || data.payload?.url }));
                                  toast.success('Splash enviada!');
                                } else { toast.error('Erro no upload'); }
                              } catch { toast.error('Erro no upload'); }
                              finally { setUploadingLogo(false); }
                            }}
                          />
                          <button
                            type="button"
                            className="h-10 px-4 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                            onClick={() => document.getElementById('splash-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            ) : (
                              <span className="material-symbols-outlined text-lg">upload</span>
                            )}
                          </button>
                        </div>
                      </div>
                      {formData.splashUri && (
                        <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                          <img src={formData.splashUri} alt="Splash" className="w-10 h-16 rounded-md object-contain bg-surface-container" />
                          <span className="text-sm text-on-surface-variant truncate flex-1">{formData.splashUri}</span>
                          <button onClick={() => setFormData({ ...formData, splashUri: '' })} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="colors" className="space-y-6 mt-0 flex-1 overflow-y-auto outline-none pr-1">
                  <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <Checkbox
                      id="useSameColors"
                      checked={useSameColors}
                      onCheckedChange={(checked) => setUseSameColors(!!checked)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-on-primary"
                    />
                    <label htmlFor="useSameColors" className="text-sm font-bold leading-none text-on-surface cursor-pointer">
                      Usar as mesmas cores para os temas Claro e Escuro
                    </label>
                  </div>

                  {useSameColors ? (
                    <div className="grid grid-cols-2 gap-6 bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Cor Primária</Label>
                        <div className="flex gap-3">
                          <input type="color" value={formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="w-12 h-10 rounded-lg border border-outline-variant/20 bg-surface-container cursor-pointer" style={{ padding: '2px' }} />
                          <Input value={formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="bg-surface-container border-outline-variant/20 text-on-surface font-mono h-10 text-sm uppercase" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Fundo Splash</Label>
                        <div className="flex gap-3">
                          <input type="color" value={formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })} className="w-12 h-10 rounded-lg border border-outline-variant/20 bg-surface-container cursor-pointer" style={{ padding: '2px' }} />
                          <Input value={formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColor: e.target.value })} className="bg-surface-container border-outline-variant/20 text-on-surface font-mono h-10 text-sm uppercase" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Coluna Tema Claro */}
                      <div className="space-y-5 bg-slate-100 p-5 rounded-xl border border-slate-300">
                        <h4 className="text-slate-800 font-bold text-sm flex items-center gap-2 border-b border-slate-300 pb-2">
                          <span className="material-symbols-outlined text-lg">light_mode</span>
                          Cores Tema Claro
                        </h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Cor Primária (Light)</Label>
                            <div className="flex gap-2">
                              <input type="color" value={formData.primaryColorLight || formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColorLight: e.target.value })} className="w-10 h-9 rounded border border-slate-300 bg-white cursor-pointer" style={{ padding: '2px' }} />
                              <Input value={formData.primaryColorLight || formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColorLight: e.target.value })} className="bg-white border-slate-300 text-slate-800 font-mono h-9 text-xs uppercase" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Fundo Splash (Light)</Label>
                            <div className="flex gap-2">
                              <input type="color" value={formData.splashBgColorLight || formData.splashBgColor || '#ffffff'} onChange={e => setFormData({ ...formData, splashBgColorLight: e.target.value })} className="w-10 h-9 rounded border border-slate-300 bg-white cursor-pointer" style={{ padding: '2px' }} />
                              <Input value={formData.splashBgColorLight || formData.splashBgColor || '#ffffff'} onChange={e => setFormData({ ...formData, splashBgColorLight: e.target.value })} className="bg-white border-slate-300 text-slate-800 font-mono h-9 text-xs uppercase" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Coluna Tema Escuro */}
                      <div className="space-y-5 bg-slate-900 p-5 rounded-xl border border-slate-700">
                        <h4 className="text-white font-bold text-sm flex items-center gap-2 border-b border-slate-700 pb-2">
                          <span className="material-symbols-outlined text-lg">dark_mode</span>
                          Cores Tema Escuro
                        </h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cor Primária (Dark)</Label>
                            <div className="flex gap-2">
                              <input type="color" value={formData.primaryColorDark || formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColorDark: e.target.value })} className="w-10 h-9 rounded border border-slate-700 bg-black cursor-pointer" style={{ padding: '2px' }} />
                              <Input value={formData.primaryColorDark || formData.primaryColor || '#00FF88'} onChange={e => setFormData({ ...formData, primaryColorDark: e.target.value })} className="bg-slate-950 border-slate-700 text-slate-200 font-mono h-9 text-xs uppercase" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Fundo Splash (Dark)</Label>
                            <div className="flex gap-2">
                              <input type="color" value={formData.splashBgColorDark || formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColorDark: e.target.value })} className="w-10 h-9 rounded border border-slate-700 bg-black cursor-pointer" style={{ padding: '2px' }} />
                              <Input value={formData.splashBgColorDark || formData.splashBgColor || '#000000'} onChange={e => setFormData({ ...formData, splashBgColorDark: e.target.value })} className="bg-slate-950 border-slate-700 text-slate-200 font-mono h-9 text-xs uppercase" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-outline-variant/10 shrink-0 bg-surface-container">
              <button onClick={() => setIsDialogOpen(false)} className="px-6 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors font-bold text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 min-w-[120px]">
                {submitting ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          </DialogContent>
