use std::sync::Arc;

use leptos::{prelude::*, task::spawn_local};
use leptos_router::{
    components::A,
    hooks::{use_navigate, use_params_map},
};
use shared::content::{CreateModel, CreateModelField};
use web_sys::SubmitEvent;

use super::ContentStore;

#[component]
pub fn Model() -> impl IntoView {
    let content_store = expect_context::<ContentStore>();
    let params = use_params_map();

    let show_create_field = signal(false);

    let model = move || {
        let params = params.get();
        let namespace = params.get("namespace");
        let Some(name) = params.get("name") else {
            log::error!("No :name in params");

            return None;
        };

        content_store
            .models()
            .get()
            .into_iter()
            .find(|m| m.namespace == namespace && m.name == name)
            .cloned()
    };

    view! {
        <div class="container">
            <div class="d-block m-auto" style="max-width: 400px;">
                { move || {
                    let fields = content_store.fields().get();

                    model().map(|m| view! {
                        <h4>{ m.name }</h4>

                        <div>
                            { m.fields.into_iter().map(|mf| {
                                let Some(field) = fields.iter().find(|f| f.id == mf.field_id) else {
                                    return view! { }.into_any();
                                };

                                view! {
                                    <div class="border rounded p-2 border-2 border-black mb-3" style="border-style: dashed !important;">
                                        <p>{ mf.name.clone() } <br/> <span>{ field.name.clone() }</span></p>
                                    </div>
                                }.into_any()
                            }).collect_view() }
                        </div>

                        <div><button type="button" class="btn btn-primary" on:click=move |_| show_create_field.1.set(true)>Add new field</button></div>
                    })
                }}
            </div>

            <Show when=move || show_create_field.0.get()>
                <CreateModelField create=move |f| {} close=move || show_create_field.1.set(false)/>
            </Show>
        </div>
    }
}

#[component]
pub fn Models() -> impl IntoView {
    let content_store = expect_context::<ContentStore>();

    view! {
        <div class="container">
            <div class="d-flex mb-4">
                <div class="flex-grow-1">
                    <h3>Models</h3>
                </div>
                <A href="/content/create-model" attr:class="btn btn-primary">Create new model</A>
            </div>

            <div class="d-block m-auto p-3" style="max-width: 400px;">
                <table class="table align-middle fs-6">
                    <thead>
                        <tr class="text-start text-gray-500 fs-7 text-uppercase" role="row">
                            <th><span class="">Name</span></th>
                            <th><span class=""># Fields</span></th>
                        </tr>
                    </thead>
                    <tbody class="fw-bold text-gray-600">
                        { move ||
                            content_store.models().get().into_iter().map(|model| {
                                let name = model.name.clone();
                                view! {
                                    <tr>
                                        <td>
                                            <A href={ if let Some(ns) = &model.namespace { format!("/content/model/{ns}/{}", model.name) } else { format!("/content/model/{}", model.name) } }>
                                                { name }
                                            </A>
                                        </td>
                                        <td> { model.fields.len() } </td>
                                    </tr>
                                }
                            }).collect_view()
                        }
                    </tbody>
                </table>
            </div>
        </div>
    }
}

#[component]
pub fn CreateModelField(
    mut create: impl FnMut(CreateModelField) + Copy + 'static,
    mut close: impl FnMut() + 'static,
) -> impl IntoView {
    #[derive(Clone, PartialEq)]
    enum ValidationError {
        Name,
        Field,
    }

    let content_store = expect_context::<ContentStore>();
    let name = RwSignal::new("".to_string());
    let field_id = RwSignal::new(Option::<i32>::None);
    let localized = RwSignal::new(false);
    let multiple = RwSignal::new(false);
    let required = RwSignal::new(false);

    let validation_errors = RwSignal::new(Vec::<ValidationError>::new());

    let mut create_field = move || {
        let mut errors = validation_errors.write();
        *errors = vec![];

        if name.read_untracked().trim().len() == 0 {
            errors.push(ValidationError::Name);
        }

        if field_id.read_untracked().is_none() {
            errors.push(ValidationError::Field);
        }

        if errors.len() > 0 {
            return;
        }

        create(CreateModelField {
            field_id: field_id.read_untracked().unwrap(),
            name: name.get_untracked(),
            localized: localized.get_untracked(),
            multiple: multiple.get_untracked(),
            required: required.get_untracked(),
        });
    };

    view! {
        <div class="modal fade show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h1 class="modal-title fs-5" id="createModelFieldModalLabel">Add Field</h1>
                    </div>
                    <div class="modal-body">
                        <form on:submit=move |e| {
                            e.prevent_default();

                            create_field();
                        }>
                            <div class="mb-3">
                                <label for="modelFieldName" class="form-label">Name</label>
                                <input bind:value=name type="text" class="form-control" id="modelFieldName"/>
                                <Show when=move || { validation_errors.read().contains(&ValidationError::Name) }>
                                    <small class="text-danger">"Please enter name"</small>
                                </Show>
                            </div>
                            <div class="mb-3">
                                <label for="modelFieldId" class="form-label">Field</label>
                                <select
                                    id="modelFieldId"
                                    class="form-select"
                                    on:change:target=move |ev| {
                                      field_id.set(Some(ev.target().value().parse().unwrap()));
                                    }
                                    prop:value=move || field_id.get().unwrap_or(0).to_string()
                                >
                                    <option disabled selected>Select a field</option>
                                    { move || content_store.fields().get().into_iter().map(|f| view! { <option value=f.id>{ f.name.clone() }</option> }).collect_view() }
                                </select>
                                <Show when=move || { validation_errors.read().contains(&ValidationError::Field) }>
                                    <small class="text-danger">"Please select a field"</small>
                                </Show>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" bind:value=localized id="modelFieldLocalized"/>
                                <label class="form-check-label" for="modelFieldLocalized">
                                  Localized
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" bind:value=multiple id="modelFieldMultiple"/>
                                <label class="form-check-label" for="modelFieldMultiple">
                                  Multiple
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" bind:value=required id="modelFieldRequired"/>
                                <label class="form-check-label" for="modelFieldRequired">
                                  Required
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" on:click=move |_| close()>Close</button>
                        <button type="button" class="btn btn-primary" on:click=move |_| create_field()>Save changes</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal-backdrop fade show"></div>
    }
}

#[component]
pub fn CreateModel() -> impl IntoView {
    #[derive(Clone, PartialEq)]
    enum ValidationError {
        Name,
        Field,
    }

    let content_store = expect_context::<ContentStore>();
    let navigate = use_navigate();

    let name = RwSignal::new("".to_string());
    let (fields, set_fields) = signal(Vec::<Arc<CreateModelField>>::new());
    let show_create_field = signal(false);

    let in_progress = RwSignal::new(false);

    let validation_errors = RwSignal::new(Vec::<ValidationError>::new());

    let on_submit = move |ev: SubmitEvent| {
        ev.prevent_default();

        if in_progress.get_untracked() {
            return;
        }

        let mut errors = validation_errors.write();
        *errors = vec![];

        log::info!("{:?}", name.get_untracked());
        if name.read_untracked().trim().len() == 0 {
            errors.push(ValidationError::Name);
        }

        if fields.read_untracked().len() == 0 {
            errors.push(ValidationError::Field);
        }

        if errors.len() > 0 {
            return;
        }

        in_progress.set(true);

        let navigate = navigate.clone();
        let model = CreateModel {
            name: name.get_untracked(),
            model_fields: fields
                .get_untracked()
                .into_iter()
                .map(|mf| CreateModelField {
                    field_id: mf.field_id,
                    name: mf.name.clone(),
                    localized: mf.localized,
                    multiple: mf.multiple,
                    required: mf.required,
                })
                .collect(),
            theme_scoped: false,
        };

        #[cfg(feature = "web")]
        spawn_local(async move {
            match content_store.create_model(model).await {
                Ok(_) => navigate("/content/models", leptos_router::NavigateOptions::default()),
                Err(e) => log::error!("Error is received, {e:?}"),
            };

            in_progress.set(false);
        });
    };

    view! {
        <div class="container">
            <h3>Create Model</h3>
            <form class="d-block m-auto" style="max-width: 400px;" on:submit=on_submit>
                <div class="mb-3">
                    <label for="modelName" class="form-label">Model Name</label>
                    <input type="text" class="form-control" id="modelName" name="name" bind:value=name/>
                    <Show when=move || { validation_errors.read().contains(&ValidationError::Name) }>
                        <small class="text-danger">"Please enter a name"</small>
                    </Show>
                </div>

                <For each=move || fields.get() key=|mf| Arc::as_ptr(mf) children=move |mf| {
                    let model_field = Arc::clone(&mf);
                    let remove = move |_| set_fields.update(|v| {
                        let Some(idx) = v.iter().position(|arc| Arc::ptr_eq(&model_field, arc)) else { return };
                        v.remove(idx);
                    });

                    view! {
                        <div class="border rounded p-2 border-2 border-black mb-3" style="border-style: dashed !important;">
                            <p>{ mf.name.clone() } <button type="button" on:click=remove>x</button></p>
                        </div>
                    }
                }/>

                <Show when=move || { validation_errors.read().contains(&ValidationError::Field) }>
                    <small class="text-danger">"Please add at least one field"</small>
                </Show>

                <div class="mb-3">
                    <button type="button" class="btn btn-secondary" on:click=move |_| show_create_field.1.set(true)>Add field</button>
                </div>

                <div class="mb-3">
                    <button type="submit" class="btn btn-primary">Create</button>
                </div>
            </form>

            <Show when=move || show_create_field.0.get()>
                <CreateModelField create=move |f| { set_fields.update(|v| v.push(Arc::new(f))); show_create_field.1.set(false) } close=move || show_create_field.1.set(false)/>
            </Show>
        </div>
    }
}
