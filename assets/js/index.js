const _subject = $("#thing-subject");
const spinnerClasses = "fas fa-spinner fa-spin";
const notDoneClasses = "far fa-circle";
const doneClasses = "far fa-check-circle";
const temp = $.trim($("#thing").html());
let db;

// TODO Util
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
            console.log('no matching object for id, canceling update', id);
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
        let x = temp.replace(/{{id}}/ig, obj.id)
            .replace(/{{subject}}/ig, obj.subject)
            .replace(/{{done}}/ig, obj.context ? "check-" : "");
        $(x).insertBefore("#new-item");
    });
}

$(document).ready(function () {
    $('input#thing-subject').characterCounter();

    let request = window.indexedDB.open("things_db", 1);
    request.onerror = function () {
        alert("Oops! Something has gone wrong.");
        console.log("Database failed to open");
    };

    request.onsuccess = function () {
        db = request.result;
        $.when(readThings()).done((data) => refreshList(data))
            .fail(function (data) {/* TODO */ });
    };

    request.onupgradeneeded = function (e) {
        let db = e.target.result;
        let objectStore = db.createObjectStore("things_os", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("created", "created", { unique: false });
        objectStore.createIndex("updated", "updated", { unique: false });
        objectStore.createIndex("subject", "subject", { unique: false });
        objectStore.createIndex("content", "content", { unique: false });
        objectStore.createIndex("context", "context", { unique: false });
        console.log("Database setup complete");
    };
});

$(function () {
    $("#thing-list").on("click", ".btn-remove", function (e) {
        e.preventDefault();
        const _btn = $(e.target);
        _btn.removeClass("far fa-trash-alt").addClass(spinnerClasses);

        deleteThing(_btn.closest('li').data('thing-id'), () => _btn.closest("li").remove());
        M.toast({html: 'Deleted!'});
    }).on("click", ".btn-toggle", function (e) {
        e.preventDefault();
        const _btn = $(e.target);
        const isDone = _btn.hasClass(doneClasses);
        _btn.removeClass(isDone ? doneClasses : notDoneClasses).addClass(spinnerClasses);
        const updatedThing = {
            id: _btn.closest('li').data('thing-id'),
            context: !_btn.hasClass(doneClasses)
        }

        updateThing(updatedThing, () => {
            if (isDone) _btn.removeClass(spinnerClasses).addClass(notDoneClasses);
            else _btn.removeClass(spinnerClasses).addClass(doneClasses);
        });
    });

    $("#thing-creation-form").submit(function (e) {
        e.preventDefault();
        const now = Date.now ? Date.now() : new Date().getTime();
        const newThing = {
            created: now,
            updated: now,
            subject: _subject.val(),
            content: "",
            context: false
        };

        createThing(
            newThing,
            () => _subject.val(""), // Move this out
            () => $.when(readThings()).done((data) => refreshList(data))
                .fail(function (data) {/* TODO */ }),
            () => console.log("Transaction not opened due to error.")
        );

        M.toast({html: 'Created!'});
    });
});