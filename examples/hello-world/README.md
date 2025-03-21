## Yelken Hello World Example
This example shows how Yelken works internally.
Easiest way to experiment with Yelken is running this example.
Before running it, please ensure that you have `docker-compose` installed and ready to be used on your machine.

To run the example, just execute
```sh
  docker-compose up
```
inside this directory and open http://127.0.0.1:8080 url in your browser.
You should see links of two articles' titles, **Hello World** and **Nice Day**.
When you click one of them, you will be navigated to the article themselves.
In addition to article links, you can change the current active locale by selecting **tr** or **en** links.

So how does that work? First of all, let us look at [init.sql](init/init.sql) file.
At the beginning of file, there are a bunch of `create table` statements which initialize the database with expected tables.
When you scroll down to bottom, you will see many `insert into` statements that creates necessary data to display when user opens website.

To begin with, we have a model called `article` with `title`, `content` and `slug` as its fields.
Each of them are marked as localizable, meaning that when you create a content for this model, you can add a value for a field for each existing locale.
Then there are two contents, named **Hello World** and **Nice Day** that are created as `article` model.
Followed by that, there are values of each content for each field of `article` model.
Up to this point, only the data is defined but how it should be displayed is not yet.

Next step is looking at [templates](theme/templates) located under theme folder.
Inside this folder, there are 3 different html file which are actually Jinja2 templates.
There is `index.html` that displays links for all articles and `article.html` that displays details of an article.
There is also `base.html` which sets a base for other templates and is extended by aforementioned two templates.

When we look at `index.html`, you can see that there is a call to `get_contents` function to load articles and there is a for loop to display a link for each article.
On the other hand, `article.html` uses `get_content` function to only load a single article matching its slug specified in the url as parameters.

Lastly, the decision of displaying which template on which url is decided by `pages` table.
You can specify a path and a template to be displayed.
When the current page url matches a path, its corresponding template will be rendered.
Each page can also have a locale that decides the exact url of the page and also the locale that should be used for displaying the page.

It is time to play with this example by changing templates and inserting new data.
Please make sure that you run `docker-compose down` after changing the **init.sql** since this script is only run when database starts up for the first time.
To make changes in templates take effect, you need to stop and run `docker-compose up` again.
