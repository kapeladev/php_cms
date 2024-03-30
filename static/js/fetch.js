/**
 * handles fetch response
 * @param {Response} response - fetch response
 * @returns {Promise<any>} - fetch promise
 */
function handle_fetch(response){
  return new Promise(async (resolve, reject)=>{
    const text = await response.text();
    // console.log(text);
    const json = JSON.parse(text);
    // const json = await response.json();
    if(json['error']) return reject(json['content']);
    resolve(json['content']);
  });
}

/**
 * fetches and returns formated promise
 * @param {string} url - url to fetch
 * @param {object} args - fetch arguments
 * @returns {Promise<any>} - fetch promise
 */
function fetch_handle(url, args = {}){
  return new Promise((resolve, reject)=>
    fetch(url, args)
      .then(handle_fetch)
      .then((data) => resolve(data))
      .catch((error) => reject(notify(error, 'error')))
  );
}


/**
 * formats html
 * moves scripts and styles to head
 * @param {string} content - html to format
 * @returns {string} - formatted html
 */
function format_html(content){
  const element = document.createElement('div');
  element.innerHTML += content;
    
  const move_to_head = (tag) => {
    element.querySelectorAll(tag).forEach(element => {
      const script = document.createElement(tag);
      script.innerHTML = element.innerHTML;
      element.remove();
      if(![...document.head.querySelectorAll(tag)].map(e=>e.innerHTML).includes(script.innerHTML))
        document.head.appendChild(script);
    });
  }

  move_to_head('script');
  move_to_head('style');
  return element.innerHTML;
}

/**
 * fetches and formats html
 * moves scripts and styles to head
 * @param {string} url - url to fetch
 * @param {object} args - fetch arguments
 * @returns {Promise<string>} - formatted html
 */
function fetch_format(url, args){
  return fetch_handle(url, args).then(format_html);
}


/**
 * appends in component content returned from url
 * @param {string} url 
 * @param {HTMLElement} element 
 * @returns {Promise<void>}
 */
function fetch_append(url, element){
  return fetch_format(url).then(content => element.insertAdjacentHTML('beforeend', content));
}

/**
 * replaces elemnt with content returned from url
 * @param {string} url - url to fetch
 * @param {HTMLElement} element - element to replace
 * @param {'outerHTML' | 'innerHTML'} additional - if 'innerHTML' then innerHTML will be replaced instead of outerHTML
 * @returns {void}
 */
function fetch_replace(url, element, additional = 'outerHTML'){
  if(Array.isArray(element) && element.length === 0) return;
  return fetch_format(url).then(content => {
    const assign_element = (element)=>{
      additional === 'innerHTML' ?
        (element.innerHTML = content) :
        (element.outerHTML = content);
    }
    !Array.isArray(element) ?
      assign_element(element) :
      element.forEach(assign_element);
  });
}


/**
 * returns form data
 * @param {HTMLElement} element 
 * @returns {object} - form data 
 */
function get_form_data(element){
  const empty_array_regex = /.*\[\].*/;
  const array_regex = /.*\[.*\].*/;
  const attr_name = "data-name";
  const ready_data = {};
  
  const elements_to_diff = [...element.querySelectorAll(`[${attr_name}]`)].map(e => [...e.querySelectorAll(`[${attr_name}]`)]).flat();
  const elements = [...element.querySelectorAll(`[${attr_name}]`)];
  const elements_filtered = elements.filter(e => !elements_to_diff.includes(e));
  elements_filtered.map(e => {
    const attr = e.getAttribute(attr_name);
    const has_extra_name = !empty_array_regex.test(attr) && array_regex.test(attr)
    const extra_name = !has_extra_name ? null : attr.slice(attr.indexOf('[') + 1, attr.indexOf(']'));
    const name = !has_extra_name ? attr : attr.slice(0, attr.indexOf('[')) + '[]';

    const data = e.value?? get_form_data(e);
    const to_add = has_extra_name ? {[extra_name]: data} : data;
    const is_array = array_regex.test(name);
    if(is_array){
      ready_data[name] ??= [];
      ready_data[name].push(to_add);
    }else{
      ready_data[name] = to_add;
    }
  });
  return ready_data;
}


/**
 * fetch component and load new from server
 * @param {string} class_name - name of component
 * @param {function} filter_function - function which filters elements to refresh
 * @returns {void}
 */
function fetch_refresh(class_name, filter_function = () => true){
  const url_search_params = new URLSearchParams({"class_name": class_name});
  const elements_before_filter = [...document.querySelectorAll(`[data-refresh="${class_name}"]`)];
  const elements = elements_before_filter.filter(filter_function);
  if(elements.length == 0) return;
  fetch_replace(`/api/components/render?${(url_search_params.toString())}`, elements.filter(e => !e.getAttribute('data-initializer')));
  elements.filter(e => e.getAttribute('data-initializer')).map(e => {
    const url_search_params = new URLSearchParams({"class_name": class_name, "initializer": e.getAttribute('data-initializer')});
    fetch_replace(`/api/components/render?${(url_search_params.toString())}`, e);
  });
}

/**
 * fetch component and load new from server
 * @param {string} class_name - name of component
 * @param {function} element - this component will be refreshed
 * @returns {void}
 */
function fetch_refresh_parent(class_name, element){
  const parent = select_parent_component(element);
  fetch_refresh(class_name, (e) => e === parent);
}

/**
 * fetches component controller
 * @param {string} class_name - name of component
 * @param {string} action - name of action which should be called
 * @param {object} body - body to send to server
 * @returns {Promise<any>} - fetch promise
*/
function fetch_controller(component, action, body = {}){
  const url_search_params = new URLSearchParams({"component": component, "action": action});
  return fetch_handle(`/api/components/controller?${(url_search_params.toString())}`, {
    'method': "POST",
    'body': JSON.stringify(body),
  });
}
