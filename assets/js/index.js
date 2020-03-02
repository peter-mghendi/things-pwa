const _subject = $("#thing-subject");
const _submit = $("#submit");
const template = $.trim($("#thing").html());
let db;

const app = $.sammy('#main', function () {
    this.get('#/', (context) => context.partial('assets/templates/home.html'));

    this.get('#/settings', (context) => context.app.swap('Settings Page')); // TODO

    this.get('#/about', (context) => context.app.swap('About Page')); // TODO

    this.post('#/things/new', function (id) {
        _subject.attr("disabled", true);
        _submit.attr("disabled", true);

        const now = Date.now ? Date.now() : new Date().getTime();
        const newThing = { // TODO Content field, soft delete
            created: now,
            updated: now,
            subject: this.params['thing-subject'],
            content: "",
            context: false
        };

        createThing(
            newThing,
            () => _subject.val(""),
            () => {
                M.toast({ html: 'Created!' });
                $.when(readThings()).done((data) => refreshList(data))
                    .fail((data) => M.toast({ html: 'Oops! Something went wrong.' }))
            },
            () => {
                M.toast({ html: 'Oops! Something went wrong.' });
                console.log("Transaction not opened due to error.");
            }
        );

        _subject.attr("disabled", false);
        _submit.attr("disabled", false);
        this.quietRoute('#/');
    });

    this.get('#/things/:id', function (context) {
        console.log(context);
        this.app.swap(`Thing ${context.params['id']}`);
    });
});

function isset(accessor) {
    try {
        return typeof accessor() !== 'undefined'
    } catch (e) {
        return false
    }
}

function createThing(thing, success, complete, failure) {
    let transaction = db.transaction(["things_os"], "readwrite");
    let objectStore = transaction.objectStore("things_os");
    let request = objectStore.add(thing);
    request.onsuccess = success;
    transaction.oncomplete = complete;
    transaction.onerror = failure;
}

function readThings() {
    let things = [];
    var defer = $.Deferred();
    let objectStore = db.transaction("things_os").objectStore("things_os");
    objectStore.openCursor().onsuccess = function (e) {
        let cursor = e.target.result;
        if (cursor) {
            things.push(cursor.value);
            cursor.continue();
        } else defer.resolve(things);
    };

    return defer.promise();
}

function updateThing(thing, callback) {
    let transaction = db.transaction(["things_os"], "readwrite");
    let objectStore = transaction.objectStore("things_os");
    var request = objectStore.get(thing.id);
    request.onsuccess = function (e) {
        var obj = request.result;
        if (!obj) {
            console.log('No matching object for id, canceling update.', id);
            return;
        }

        if (isset(() => thing.subject)) obj.subject = thing.subject;
        if (isset(() => thing.content)) obj.content = thing.content;
        if (isset(() => thing.context)) obj.context = thing.context;
        obj.updated = Date.now ? Date.now() : new Date().getTime();
        objectStore.put(obj);
        callback();
    }
}

function deleteThing(thingID, callback) {
    let transaction = db.transaction(['things_os'], 'readwrite');
    let objectStore = transaction.objectStore('things_os');
    let request = objectStore.delete(thingID);
    transaction.oncomplete = callback
}

function refreshList(things) {
    $("#thing-list li:not(:last)").remove();
    $.each(things, function (index, obj) {
        let x = template.replace(/{{id}}/ig, obj.id)
            .replace(/{{subject}}/ig, obj.subject)
            .replace(/{{context}}/ig, obj.context ? "checked=\"checked\"" : "");
        $(x).insertBefore("#new-item");
    });
}

$(document).ready(function () {
    $('.sidenav').sidenav();
    $('input#thing-subject').characterCounter();

    if (!localStorage.getItem('isInformedOfCookie')) 
        M.Modal.init(document.querySelector('#cookieModal'), { onCloseEnd: () => {
            localStorage.setItem('isInformedOfCookie', true);
            M.toast({html: 'Changes saved!'});
        }
    }).open();

    let request = window.indexedDB.open("things_db", 1);
    request.onerror = function () {
        M.toast({ html: 'Oops! Something went wrong.' });
        console.log("Database failed to open.");
    };

    request.onsuccess = function () {
        db = request.result;
        $.when(readThings()).done((data) => refreshList(data))
            .fail((data) => M.toast({ html: 'Oops! Something went wrong.' }));
    };

    request.onupgradeneeded = function (e) {
        let db = e.target.result;
        let objectStore = db.createObjectStore("things_os", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("created", "created", { unique: false });
        objectStore.createIndex("updated", "updated", { unique: false });
        objectStore.createIndex("subject", "subject", { unique: false });
        objectStore.createIndex("content", "content", { unique: false });
        objectStore.createIndex("context", "context", { unique: false });
        console.log("Database setup complete.");
    };
});

$(function () {
    $("#thing-list").on("click", ".btn-remove", function (e) {
        e.preventDefault();
        const _btn = $(e.target);
        _btn.attr("disabled", true);
        deleteThing(_btn.closest('li').data('thing-id'), () => _btn.closest("li").remove());
        M.toast({ html: 'Deleted!' });
    }).on("change", ".btn-toggle", function (e) {
        e.preventDefault();
        const _btn = $(e.target);
        const isDone = _btn.is(":checked");
        _btn.prop("indeterminate", true).attr("disabled", true);
        const updatedThing = {
            id: _btn.closest('li').data('thing-id'),
            context: isDone
        }

        updateThing(updatedThing, () => _btn.prop("indeterminate", false).attr("disabled", false).prop("checked", isDone));
    });

    app.run();
});